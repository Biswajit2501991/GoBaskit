import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkoutSchema } from '@/lib/validations';
import { deliveryChargeFrom } from '@/constants';
import { deliveryIsServiceable } from '@/utils/delivery';
import { SettingsService } from '@/services/SettingsService';
import { OrderService } from '@/services/OrderService';
import { NotificationService } from '@/services/NotificationService';
import { CustomerProfileService } from '@/services/CustomerProfileService';
import { profileFromCheckout } from '@/utils/customerProfile';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer, items, paymentMethod, orderSource, customerLat, customerLng } = body;

    const parsed = checkoutSchema.safeParse({ ...customer, paymentMethod });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (!items?.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const config = await SettingsService.getStoreConfig();

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

    const subtotal = items.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
      0,
    );

    if (config.minOrderValue > 0 && subtotal < config.minOrderValue) {
      return NextResponse.json(
        { error: `Minimum order value is ₹${config.minOrderValue}.` },
        { status: 400 },
      );
    }

    const deliveryCharge = deliveryChargeFrom(config.deliverySlabs, subtotal);
    const grandTotal = subtotal + deliveryCharge;
    const orderNumber = `GB${Date.now().toString().slice(-8)}`;
    const source = orderSource === 'whatsapp' ? 'whatsapp' : 'website';

    const dbCustomer = await prisma.customer.create({
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
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: dbCustomer.id,
        subtotal,
        deliveryCharge,
        grandTotal,
        paymentMethod: parsed.data.paymentMethod,
        deliveryNotes: parsed.data.deliveryNotes || null,
        orderSource: source,
        customerLat: typeof customerLat === 'number' ? customerLat : null,
        customerLng: typeof customerLng === 'number' ? customerLng : null,
        items: {
          create: items.map(
            (item: { productId: string; name: string; quantity: number; price: number; unit: string }) => ({
              productId: item.productId,
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

    await OrderService.onOrderCreated(order);
    await NotificationService.notifyNewOrder({
      id: order.id,
      orderNumber: order.orderNumber,
      grandTotal: order.grandTotal,
      paymentMethod: order.paymentMethod,
      orderSource: source,
      customer: order.customer,
      customerLat: order.customerLat,
      customerLng: order.customerLng,
    });

    try {
      await CustomerProfileService.save(
        parsed.data.mobile,
        profileFromCheckout(parsed.data),
      );
    } catch {
      /* profile save is best-effort */
    }

    return NextResponse.json({ order, orderNumber });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
