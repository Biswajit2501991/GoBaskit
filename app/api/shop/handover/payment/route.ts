import { NextRequest, NextResponse } from 'next/server';
import { requireShopStaff } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { ShopHandoverService } from '@/services/ShopHandoverService';
import { ShopSourcingError } from '@/services/ShopSourcingService';

export async function POST(req: NextRequest) {
  const auth = await requireShopStaff();
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const fulfillmentId = String(body.fulfillmentId ?? '');
  const paymentStatus = body.paymentStatus === 'PENDING' ? 'PENDING' : body.paymentStatus === 'PAID' ? 'PAID' : null;
  if (!fulfillmentId || !paymentStatus) {
    return NextResponse.json({ error: 'Choose Payment done or Pending' }, { status: 400 });
  }
  try {
    const shopSourcing = await ShopHandoverService.markPayment({
      fulfillmentId,
      paymentStatus,
      shopId: auth.staff!.shopId!,
      actorId: auth.staff!.id,
      mode: 'shop',
    });
    return NextResponse.json({ ok: true, shopSourcing });
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not save payment' }, { status: 400 });
  }
}
