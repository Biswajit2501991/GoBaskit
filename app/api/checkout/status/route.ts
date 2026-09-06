import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { normalizeMobile } from '@/utils/mobile';
import { parseIdempotencyKey } from '@/lib/checkoutOrder';

export async function GET(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ ok: false, pending: false }, { status: 401 });
  }

  const key = parseIdempotencyKey(req.nextUrl.searchParams.get('key'));
  if (!key) {
    return NextResponse.json({ ok: false, pending: false });
  }

  const order = await prisma.order.findUnique({
    where: { idempotencyKey: key },
    select: {
      id: true,
      orderNumber: true,
      grandTotal: true,
      customer: { select: { mobile: true } },
    },
  });

  if (!order || normalizeMobile(order.customer.mobile) !== mobile) {
    return NextResponse.json({ ok: false, pending: true });
  }

  return NextResponse.json({
    ok: true,
    pending: false,
    orderNumber: order.orderNumber,
    orderId: order.id,
    grandTotal: order.grandTotal,
    order: { id: order.id, orderNumber: order.orderNumber },
  });
}
