import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkoutSchema } from '@/lib/validations';
import { deliveryChargeFrom } from '@/constants';
import { deliveryIsServiceable } from '@/utils/delivery';
import { SettingsService } from '@/services/SettingsService';
import { OrderService } from '@/services/OrderService';
import { NotificationService } from '@/services/NotificationService';
import { CustomerProfileService } from '@/services/CustomerProfileService';
import { InventoryService } from '@/services/InventoryService';
import { DiscountEngine } from '@/services/DiscountEngine';
import { profileFromCheckout } from '@/utils/customerProfile';
import { toE164 } from '@/utils/phone';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';
import {
  CUSTOMER_MOBILE_COOKIE,
  createCustomerSessionToken,
  customerSessionCookieOptions,
} from '@/lib/customer-session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer, items, paymentMethod, orderSource, customerLat, customerLng, discount } = body;

    const parsed = checkoutSchema.safeParse({ ...customer, paymentMethod });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (!items?.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const subtotal = items.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
      0,
    );

    const stockItems = items.map(
      (item: { productId: string; variantId?: string | null; quantity: number }) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
      }),
    );

    const mobileE164 = toE164('91', parsed.data.mobile) ?? `+91${parsed.data.mobile}`;
    const discountRequest = discount && typeof discount === 'object' ? discount : null;
    const discountTypeRaw =
      discountRequest?.type === 'COUPON' || discountRequest?.type === 'MEMBERSHIP'
        ? discountRequest.type
        : 'NONE';

    // Run independent pre-checks in parallel (biggest checkout latency win).
    const [config, resolvedDiscount, , verification] = await Promise.all([
      SettingsService.getStoreConfig(),
      DiscountEngine.resolveForCheckout({
        type: discountTypeRaw,
        couponCode: typeof discountRequest?.couponCode === 'string' ? discountRequest.couponCode : null,
        mobile: parsed.data.mobile,
        subtotal,
        clientDiscountAmount:
          typeof discountRequest?.discountAmount === 'number' ? discountRequest.discountAmount : null,
      }),
      InventoryService.validateCheckoutItems(stockItems),
      WhatsAppVerificationService.getCheckoutVerificationState(mobileE164),
    ]);

    if (!resolvedDiscount.ok) {
      return NextResponse.json({ error: resolvedDiscount.error }, { status: 400 });
    }

    const serviceable = deliveryIsServiceable({
      serviceablePins: config.serviceablePins,
      serviceableCities: config.serviceableCities,
      city: parsed.data.city,
      pincode: parsed.data.pincode,
      cityAliases: config.cityAliases,
    });

    if (!serviceable) {
      return NextResponse.json(
        { error: 'Sorry, delivery is currently unavailable in your area.' },
        { status: 400 },
      );
    }

    if (config.minOrderValue > 0 && subtotal < config.minOrderValue) {
      return NextResponse.json(
        { error: `Minimum order value is ₹${config.minOrderValue}.` },
        { status: 400 },
      );
    }

    if (verification.needsVerification && !verification.isVerified) {
      return NextResponse.json(
        { error: 'WhatsApp verification required before placing your first order.', code: 'VERIFICATION_REQUIRED' },
        { status: 403 },
      );
    }

    const isWhatsappVerified = verification.isVerified;
    const deliveryCharge = deliveryChargeFrom(config.deliverySlabs, subtotal);
    const discountAmount = resolvedDiscount.discountAmount;
    const grandTotal = Math.max(0, subtotal - discountAmount + deliveryCharge);
    const orderNumber = `GB${Date.now().toString().slice(-8)}`;
    const source = orderSource === 'whatsapp' ? 'whatsapp' : 'website';

    let inventoryUpdates: {
      updated: Awaited<ReturnType<typeof InventoryService.reserveForOrder>>['updated'];
      previousStock: Map<string, number>;
    };

    const order = await prisma.$transaction(async (tx) => {
      const dbCustomer = await tx.customer.create({
        data: {
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          mobile: parsed.data.mobile,
          alternateMobile: parsed.data.alternateMobile || null,
          houseNumber: parsed.data.houseNumber,
          street: parsed.data.street,
          area: parsed.data.area,
          landmark: parsed.data.landmark || null,
          city: parsed.data.city,
          state: parsed.data.state,
          pincode: parsed.data.pincode || '',
          isWhatsappVerified,
        },
      });

      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId: dbCustomer.id,
          subtotal,
          deliveryCharge,
          discountAmount,
          discountType: resolvedDiscount.discountType,
          couponCode: resolvedDiscount.couponCode,
          membershipMemberId: resolvedDiscount.memberId,
          grandTotal,
          paymentMethod: parsed.data.paymentMethod,
          deliveryNotes: parsed.data.deliveryNotes || null,
          orderSource: source,
          customerLat: typeof customerLat === 'number' ? customerLat : null,
          customerLng: typeof customerLng === 'number' ? customerLng : null,
          items: {
            create: items.map(
              (item: {
                productId: string;
                variantId?: string | null;
                name: string;
                quantity: number;
                price: number;
                unit: string;
              }) => ({
                productId: item.productId,
                variantId: item.variantId ?? null,
                productName: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                unit: item.unit,
                totalPrice: item.price * item.quantity,
              }),
            ),
          },
        },
        include: { items: true, customer: true },
      });

      if (resolvedDiscount.discountType !== 'NONE' && discountAmount > 0) {
        await DiscountEngine.recordCheckoutDiscount(tx, {
          orderId: created.id,
          mobile: parsed.data.mobile,
          discountType: resolvedDiscount.discountType,
          discountAmount,
          couponId: resolvedDiscount.couponId,
          couponCode: resolvedDiscount.couponCode,
          memberId: resolvedDiscount.memberId,
        });
      }

      inventoryUpdates = await InventoryService.reserveForOrder(tx, created.id, stockItems);
      return created;
    });

    // Respond immediately; run non-critical side effects after the response is queued.
    const res = NextResponse.json({ order, orderNumber });
    if (isWhatsappVerified) {
      res.cookies.set(
        CUSTOMER_MOBILE_COOKIE,
        createCustomerSessionToken(parsed.data.mobile),
        customerSessionCookieOptions(),
      );
    }

    void Promise.allSettled([
      InventoryService.afterOrderReserved(inventoryUpdates!.updated, inventoryUpdates!.previousStock),
      OrderService.onOrderCreated(order),
      NotificationService.notifyNewOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        grandTotal: order.grandTotal,
        paymentMethod: order.paymentMethod,
        orderSource: source,
        customer: order.customer,
        customerLat: order.customerLat,
        customerLng: order.customerLng,
      }),
      CustomerProfileService.save(parsed.data.mobile, profileFromCheckout(parsed.data)),
    ]).catch((err) => {
      console.error('Checkout post-order side effects failed:', err);
    });

    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to place order';
    console.error('Checkout error:', error);
    const status = message.includes('stock') || message.includes('unavailable') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
