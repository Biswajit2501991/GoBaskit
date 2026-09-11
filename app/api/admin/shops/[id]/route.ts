import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { ShopSourcingError, ShopSourcingService } from '@/services/ShopSourcingService';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireStaffPermission('settings:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const shop = await ShopSourcingService.upsertShop({
      id,
      name: String(body.name ?? ''),
      phone: String(body.phone ?? ''),
      address: String(body.address ?? ''),
      city: String(body.city ?? ''),
      active: body.active !== false,
    });
    return NextResponse.json(shop);
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not save shop' }, { status: 400 });
  }
}
