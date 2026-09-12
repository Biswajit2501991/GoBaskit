import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { ShopSourcingError, ShopSourcingService } from '@/services/ShopSourcingService';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireStaffPermission('settings:view');
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const data = await ShopSourcingService.listCatalogForShop(id);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not load shop products' }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireStaffPermission('products:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const productIds = Array.isArray(body.productIds) ? body.productIds.map(String) : [];
  try {
    const result = await ShopSourcingService.setShopCatalog(id, productIds);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not save shop products' }, { status: 400 });
  }
}
