import { NextRequest, NextResponse } from 'next/server';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { requireSameOrigin } from '@/lib/security';
import { CustomerOrderService } from '@/services/CustomerOrderService';
import { OrderEditError, OrderMutationService } from '@/services/OrderMutationService';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const { id } = await params;
  try {
    await OrderMutationService.cancelForCustomer(id, mobile);
    const order = await CustomerOrderService.getByIdForMobile(id, mobile);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderEditError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Could not cancel order';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
