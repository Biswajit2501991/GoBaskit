import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { ShopSourcingError, ShopSourcingService } from '@/services/ShopSourcingService';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireStaffPermission('products:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const shopIds = Array.isArray(body.shopIds) ? body.shopIds.map(String) : [];
  try {
    const saved = await ShopSourcingService.setProductShops(id, shopIds);
    return NextResponse.json({ shopIds: saved });
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not tag shops' }, { status: 400 });
  }
}
