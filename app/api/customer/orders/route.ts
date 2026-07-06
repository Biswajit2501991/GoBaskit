import { NextRequest, NextResponse } from 'next/server';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { CustomerOrderService } from '@/services/CustomerOrderService';

export async function GET(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const activeOnly = req.nextUrl.searchParams.get('active') === '1';
  const orders = await CustomerOrderService.listForMobile(mobile, { activeOnly });
  const activeCount = activeOnly
    ? orders.length
    : await CustomerOrderService.getActiveCount(mobile);

  return NextResponse.json({
    orders,
    activeCount,
    hasActiveOrders: activeCount > 0,
  });
}
