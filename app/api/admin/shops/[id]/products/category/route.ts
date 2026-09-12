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
  const categoryId = String(body.categoryId ?? '');
  const assigned = body.assigned === true;
  if (!categoryId) {
    return NextResponse.json({ error: 'Pick a category' }, { status: 400 });
  }
  try {
    const result = await ShopSourcingService.setShopCategory(id, categoryId, assigned);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not update category for this shop' }, { status: 400 });
  }
}
