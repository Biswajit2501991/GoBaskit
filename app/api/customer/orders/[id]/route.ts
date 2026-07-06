import { NextRequest, NextResponse } from 'next/server';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { CustomerOrderService } from '@/services/CustomerOrderService';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const { id } = await params;
  const order = await CustomerOrderService.getByIdForMobile(id, mobile);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({ order });
}
