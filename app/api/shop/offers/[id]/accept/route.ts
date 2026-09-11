import { NextRequest, NextResponse } from 'next/server';
import { requireShopStaff } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { ShopSourcingError, ShopSourcingService } from '@/services/ShopSourcingService';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireShopStaff();
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map(String) : [];
  const pickupAt = new Date(String(body.pickupAt ?? ''));
  const costToGobaskit = Number(body.costToGobaskit);

  try {
    const result = await ShopSourcingService.acceptOffer({
      shopId: auth.staff!.shopId!,
      staffId: auth.staff!.id,
      offerId: id,
      itemIds,
      pickupAt,
      costToGobaskit,
    });
    return NextResponse.json({
      ok: true,
      ticket: result.ticket,
      suffix: result.fulfillment.suffix,
    });
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Could not accept pickup';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
