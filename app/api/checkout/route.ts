import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkoutSchema } from '@/lib/validations';
import { calculateDeliveryCharge, isPinServiceable, MIN_ORDER_VALUE } from '@/constants';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer, items, paymentMethod } = body;

    const parsed = checkoutSchema.safeParse({ ...customer, paymentMethod });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (!items?.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    if (!isPinServiceable(parsed.data.pincode)) {
      return NextResponse.json(
        { error: 'Sorry, delivery is currently unavailable in your area.' },
        { status: 400 }
      );
    }

    const subtotal = items.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
      0
    );

    if (MIN_ORDER_VALUE > 0 && subtotal < MIN_ORDER_VALUE) {
      return NextResponse.json(
        { error: `Minimum order value is ₹${MIN_ORDER_VALUE}.` },
        { status: 400 }
      );
    }

    const deliveryCharge = calculateDeliveryCharge(subtotal);
    const grandTotal = subtotal + deliveryCharge;

    const orderNumber = `GB${Date.now().toString().slice(-8)}`;

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
        pincode: parsed.data.pincode,
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
        items: {
          create: items.map((item: { productId: string; name: string; quantity: number; price: number; unit: string }) => ({
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            unit: item.unit,
            totalPrice: item.price * item.quantity,
          })),
        },
      },
      include: { items: true, customer: true },
    });

    return NextResponse.json({ order, orderNumber });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
