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
  try {
    await ShopSourcingService.rejectOffer(auth.staff!.shopId!, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not decline pickup' }, { status: 400 });
  }
}
