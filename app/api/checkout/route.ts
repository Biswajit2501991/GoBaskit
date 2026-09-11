import { NextRequest, NextResponse, after } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  checkoutPlaceOrderUserMessage,
  isRetryableInteractiveTxnError,
  runInteractiveTxn,
} from '@/lib/prismaInteractiveTxn';
import { checkoutSchema, formatZodFlattenError } from '@/lib/validations';
import { extractLearnableTokens, setLearnedDeliveryLocalities } from '@/lib/deliveryAddress';
import { ShopSourcingService } from '@/services/ShopSourcingService';
import { deliveryChargeFrom } from '@/constants';
import { deliveryIsServiceable } from '@/utils/delivery';
import { SettingsService } from '@/services/SettingsService';
import { OrderService } from '@/services/OrderService';
import { NotificationService } from '@/services/NotificationService';
import { CustomerProfileService } from '@/services/CustomerProfileService';
import { InventoryService } from '@/services/InventoryService';
import { DiscountEngine } from '@/services/DiscountEngine';
import { CheckoutQuoteService } from '@/services/CheckoutQuoteService';
import { profileFromCheckout } from '@/utils/customerProfile';
import { toE164 } from '@/utils/phone';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';
import {
  CUSTOMER_MOBILE_COOKIE,
  createCustomerSessionToken,
  customerSessionCookieOptions,
  getCustomerMobileFromRequest,
} from '@/lib/customer-session';
import { normalizeMobile } from '@/utils/mobile';
import {
  amountsClose,
  CHECKOUT_CODES,
  generateOrderNumber,
  isIdempotencyKeyConflict,
  isOrderNumberConflict,
  parseIdempotencyKey,
  stockOrUnavailableCode,
} from '@/lib/checkoutOrder';
import { nightDeliveryCopy, nightDeliveryWindow } from '@/lib/nightDelivery';

type CheckoutLineItem = {
  productId: string;
  variantId?: string | null;
  name: string;
  quantity: number;
  price: number;
  unit: string;
};

function jsonError(error: string, code: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, code, ...extra }, { status });
}

function orderOwnedBySession(
  orderMobile: string,
  sessionMobile: string,
): boolean {
  return normalizeMobile(orderMobile) === sessionMobile;
}

async function findOrderByIdempotencyKey(key: string, sessionMobile: string) {
  const order = await prisma.order.findUnique({
    where: { idempotencyKey: key },
    select: {
      id: true,
      orderNumber: true,
      grandTotal: true,
      status: true,
      paymentMethod: true,
      customerLat: true,
      customerLng: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          mobile: true,
          city: true,
          houseNumber: true,
          street: true,
          area: true,
          pincode: true,
        },
      },
    },
  });
  if (!order) return null;
  if (!orderOwnedBySession(order.customer.mobile, sessionMobile)) return 'foreign' as const;
  return order;
}

function successPayload(
  order: { id: string; orderNumber: string; grandTotal: number },
  started: number,
  replay = false,
  extras?: { deliveryPin?: string },
) {
  return {
    ok: true as const,
    orderNumber: order.orderNumber,
    orderId: order.id,
    grandTotal: order.grandTotal,
    replay,
    ms: Date.now() - started,
    order: { id: order.id, orderNumber: order.orderNumber },
    ...(extras?.deliveryPin ? { deliveryPin: extras.deliveryPin } : {}),
  };
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const sessionMobile = getCustomerMobileFromRequest(req);
    if (!sessionMobile) {
      return jsonError('Please log in to place your order.', CHECKOUT_CODES.LOGIN_REQUIRED, 401);
    }

    const body = await req.json();
    const { customer, items, paymentMethod, orderSource, customerLat, customerLng, discount } = body;
    const idempotencyKey = parseIdempotencyKey(
      req.headers.get('idempotency-key') || body?.idempotencyKey,
    );

    if (idempotencyKey) {
      const existing = await findOrderByIdempotencyKey(idempotencyKey, sessionMobile);
      if (existing === 'foreign') {
        return jsonError('Could not place this order. Please try again.', CHECKOUT_CODES.FAILED, 409);
      }
      if (existing) {
        return NextResponse.json(successPayload(existing, started, true));
      }
    }

    const configForAddress = await SettingsService.getStoreConfig();
    setLearnedDeliveryLocalities(configForAddress.deliveryAddressLocalities);

    const parsed = checkoutSchema.safeParse({
      landmark: '',
      deliveryNotes: '',
      ...customer,
      paymentMethod,
    });
    if (!parsed.success) {
      return jsonError(formatZodFlattenError(parsed.error.flatten()), CHECKOUT_CODES.INVALID, 400);
    }

    if (normalizeMobile(parsed.data.mobile) !== sessionMobile) {
      return jsonError(
        'Checkout mobile must match your logged-in account. Please use your account mobile number.',
        CHECKOUT_CODES.MOBILE_MISMATCH,
        403,
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return jsonError('Cart is empty', CHECKOUT_CODES.EMPTY, 400);
    }

    const checkoutItems = items as CheckoutLineItem[];
    const namedItems = await CheckoutQuoteService.quoteLines(checkoutItems);
    const subtotal = namedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const stockItems = namedItems.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }));

    const mobileE164 = toE164('91', parsed.data.mobile) ?? `+91${parsed.data.mobile}`;
    const discountRequest = discount && typeof discount === 'object' ? discount : null;
    const discountTypeRaw =
      discountRequest?.type === 'COUPON' || discountRequest?.type === 'MEMBERSHIP'
        ? discountRequest.type
        : 'NONE';

    const [config, resolvedDiscount, verification] = await Promise.all([
      SettingsService.getStoreConfig(),
      DiscountEngine.resolveForCheckout({
        type: discountTypeRaw,
        couponCode: typeof discountRequest?.couponCode === 'string' ? discountRequest.couponCode : null,
        mobile: sessionMobile,
        subtotal,
        clientMemberId: typeof discountRequest?.memberId === 'string' ? discountRequest.memberId : null,
      }),
      WhatsAppVerificationService.getCheckoutVerificationState(mobileE164),
    ]);

    if (!resolvedDiscount.ok) {
      return jsonError(resolvedDiscount.error, CHECKOUT_CODES.DISCOUNT, 400);
    }

    const serviceable = deliveryIsServiceable({
      serviceablePins: config.serviceablePins,
      serviceableCities: config.serviceableCities,
      city: parsed.data.city,
      pincode: parsed.data.pincode,
      cityAliases: config.cityAliases,
    });

    if (!serviceable) {
      return jsonError(
        'Sorry, delivery is currently unavailable in your area.',
        CHECKOUT_CODES.UNAVAILABLE,
        400,
      );
    }

    if (config.minOrderValue > 0 && subtotal < config.minOrderValue) {
      return jsonError(`Minimum order value is ₹${config.minOrderValue}.`, CHECKOUT_CODES.INVALID, 400);
    }

    if (!verification.isVerified) {
      return jsonError(
        'Please complete WhatsApp verification before placing your order.',
        CHECKOUT_CODES.VERIFICATION_REQUIRED,
        403,
      );
    }

    const isWhatsappVerified = verification.isVerified;
    const deliveryCharge = deliveryChargeFrom(config.deliverySlabs, subtotal);
    const discountAmount = resolvedDiscount.discountAmount;
    const grandTotal = Math.max(0, subtotal - discountAmount + deliveryCharge);
    const clientGrandTotal =
      typeof body?.clientGrandTotal === 'number' && Number.isFinite(body.clientGrandTotal)
        ? body.clientGrandTotal
        : null;

    if (clientGrandTotal != null && !amountsClose(clientGrandTotal, grandTotal)) {
      return jsonError(
        'Prices were updated. Please review the new total and tap Place Order again.',
        CHECKOUT_CODES.PRICE_CHANGED,
        409,
        {
          quote: {
            items: namedItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              price: item.price,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
            })),
            subtotal,
            deliveryCharge,
            discountAmount,
            grandTotal,
          },
        },
      );
    }

    const overnightWindow = nightDeliveryWindow(undefined, config.overnightCheckout);
    const overnight = nightDeliveryCopy(overnightWindow, config.overnightCheckout);
    if (overnight && body?.nightDeliveryAck !== true) {
      return jsonError(overnight.message, CHECKOUT_CODES.NIGHT_DELIVERY_ACK, 409, {
        window: overnightWindow,
        title: overnight.title,
        message: overnight.message,
      });
    }

    const source = orderSource === 'whatsapp' ? 'whatsapp' : 'website';

    let inventoryUpdates: {
      productIds: string[];
      qtyByProduct: Map<string, number>;
      variantIds: string[];
      qtyByVariant: Map<string, number>;
    };

    const createOrder = async (orderNumber: string) =>
      runInteractiveTxn(async (tx) => {
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mobile: true,
            city: true,
            houseNumber: true,
            street: true,
            area: true,
            pincode: true,
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
            deliveryNotes: [parsed.data.deliveryNotes, overnight?.staffNote].filter(Boolean).join('\n') || null,
            orderSource: source,
            customerLat: typeof customerLat === 'number' ? customerLat : null,
            customerLng: typeof customerLng === 'number' ? customerLng : null,
            idempotencyKey,
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotal: true,
            paymentMethod: true,
            customerLat: true,
            customerLng: true,
          },
        });

        await tx.orderItem.createMany({
          data: namedItems.map((item) => ({
            orderId: created.id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            unit: item.unit,
            totalPrice: item.price * item.quantity,
          })),
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
        return { ...created, customer: dbCustomer };
      });

    let order;
    try {
      order = await createOrder(generateOrderNumber());
    } catch (err) {
      if (idempotencyKey && isIdempotencyKeyConflict(err)) {
        const existing = await findOrderByIdempotencyKey(idempotencyKey, sessionMobile);
        if (existing && existing !== 'foreign') {
          return NextResponse.json(successPayload(existing, started, true));
        }
      }
      if (isOrderNumberConflict(err)) {
        order = await createOrder(generateOrderNumber());
      } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && idempotencyKey) {
        const existing = await findOrderByIdempotencyKey(idempotencyKey, sessionMobile);
        if (existing && existing !== 'foreign') {
          return NextResponse.json(successPayload(existing, started, true));
        }
        throw err;
      } else {
        throw err;
      }
    }

    const deliveryPin =
      config.shopSourcing.enabled === true
        ? await ShopSourcingService.createDeliveryPin(order.id)
        : '';
    const res = NextResponse.json(
      successPayload(order, started, false, deliveryPin ? { deliveryPin } : undefined),
    );
    if (isWhatsappVerified) {
      res.cookies.set(
        CUSTOMER_MOBILE_COOKIE,
        createCustomerSessionToken(parsed.data.mobile),
        customerSessionCookieOptions(),
      );
    }

    const inventorySnapshot = inventoryUpdates!;
    const orderSnapshot = order;
    const profileMobile = parsed.data.mobile;
    const profileData = profileFromCheckout(parsed.data);
    after(async () => {
      try {
        await Promise.allSettled([
          InventoryService.afterOrderReserved(
            inventorySnapshot.productIds,
            inventorySnapshot.qtyByProduct,
            inventorySnapshot.variantIds,
            inventorySnapshot.qtyByVariant,
          ),
          OrderService.onOrderCreated({
            id: orderSnapshot.id,
            orderNumber: orderSnapshot.orderNumber,
            grandTotal: orderSnapshot.grandTotal,
            status: orderSnapshot.status,
            customer: orderSnapshot.customer,
          }),
          NotificationService.notifyNewOrder({
            id: orderSnapshot.id,
            orderNumber: orderSnapshot.orderNumber,
            grandTotal: orderSnapshot.grandTotal,
            paymentMethod: orderSnapshot.paymentMethod,
            orderSource: source,
            items: namedItems.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
            })),
            customer: {
              firstName: orderSnapshot.customer.firstName,
              lastName: orderSnapshot.customer.lastName,
              mobile: orderSnapshot.customer.mobile,
              city: orderSnapshot.customer.city,
              houseNumber: orderSnapshot.customer.houseNumber,
              street: orderSnapshot.customer.street,
              area: orderSnapshot.customer.area,
              pincode: orderSnapshot.customer.pincode,
            },
            customerLat: orderSnapshot.customerLat,
            customerLng: orderSnapshot.customerLng,
          }),
          CustomerProfileService.save(profileMobile, profileData),
          SettingsService.mergeDeliveryAddressLocalities(
            extractLearnableTokens(
              parsed.data.houseNumber,
              parsed.data.street,
              parsed.data.area,
              parsed.data.landmark,
            ),
          ),
          ShopSourcingService.startForOrder(orderSnapshot.id),
        ]);
      } catch (err) {
        console.error('Checkout post-order side effects failed:', err);
      }
    });

    return res;
  } catch (error) {
    const message = checkoutPlaceOrderUserMessage(error);
    console.error('Checkout error:', error);
    if (isRetryableInteractiveTxnError(error)) {
      return jsonError(message, CHECKOUT_CODES.RETRY, 503);
    }
    const code = stockOrUnavailableCode(message);
    const status = code === CHECKOUT_CODES.FAILED ? 500 : 400;
    return jsonError(message, code, status);
  }
}
