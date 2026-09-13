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
  const code = String(body.code ?? '');
  try {
    const result = await ShopHandoverService.verifyForShop(auth.staff!.shopId!, code);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not verify shop code' }, { status: 400 });
  }
}
