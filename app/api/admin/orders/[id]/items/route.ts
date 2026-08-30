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
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Items are required' }, { status: 400 });
  }

  try {
    const order = await OrderMutationService.replaceItems({
      orderId: id,
      items: body.items,
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
