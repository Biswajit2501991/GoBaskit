import { NextRequest, NextResponse } from 'next/server';
import { requireShopStaff, requireShopSourcingEnabled } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { ShopSourcingError, ShopSourcingService } from '@/services/ShopSourcingService';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireShopStaff();
  if (auth.error) return auth.error;
  const disabled = await requireShopSourcingEnabled();
  if (disabled) return disabled;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    const shopSourcing = await ShopSourcingService.saveFulfillmentCosts({
      fulfillmentId: id,
      items: body.items,
      mode: 'shop-confirm',
      shopId: auth.staff!.shopId!,
    });
    return NextResponse.json({ ok: true, shopSourcing });
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Could not save costs';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
