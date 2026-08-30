import { NextRequest, NextResponse } from 'next/server';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { requireSameOrigin } from '@/lib/security';
import { CustomerOrderService } from '@/services/CustomerOrderService';
import { OrderEditError, OrderMutationService } from '@/services/OrderMutationService';

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

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    if (Array.isArray(body.items)) {
      await OrderMutationService.replaceItems({
        orderId: id,
        items: body.items,
        actor: { type: 'customer', mobile },
      });
    }
    if (body.delivery && typeof body.delivery === 'object') {
      await OrderMutationService.updateDelivery({
        orderId: id,
        delivery: body.delivery,
        actor: { type: 'customer', mobile },
      });
    }
    if (!Array.isArray(body.items) && !(body.delivery && typeof body.delivery === 'object')) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const order = await CustomerOrderService.getByIdForMobile(id, mobile);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderEditError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
