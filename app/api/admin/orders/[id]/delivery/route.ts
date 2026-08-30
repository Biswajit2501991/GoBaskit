import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { OrderEditError, OrderMutationService } from '@/services/OrderMutationService';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('orders:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const delivery = body.delivery && typeof body.delivery === 'object' ? body.delivery : body;
  if (!delivery || typeof delivery !== 'object') {
    return NextResponse.json({ error: 'Delivery details required' }, { status: 400 });
  }

  try {
    const order = await OrderMutationService.updateDelivery({
      orderId: id,
      delivery,
      actor: {
        type: 'staff',
        staff: { id: auth.staff!.id, role: auth.staff!.role, permissions: auth.staff!.permissions },
      },
    });
    return NextResponse.json(order);
  } catch (err) {
    if (err instanceof OrderEditError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
