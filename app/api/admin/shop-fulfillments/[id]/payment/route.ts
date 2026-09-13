import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { ShopHandoverService } from '@/services/ShopHandoverService';
import { ShopSourcingError } from '@/services/ShopSourcingService';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireStaffPermission('orders:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.paymentStatus !== 'PAID') {
    return NextResponse.json({ error: 'Only Mark paid is allowed here' }, { status: 400 });
  }
  try {
    const shopSourcing = await ShopHandoverService.markPayment({
      fulfillmentId: id,
      paymentStatus: 'PAID',
      actorId: auth.staff!.id,
      mode: 'admin',
    });
    return NextResponse.json({ ok: true, shopSourcing });
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not mark paid' }, { status: 400 });
  }
}
