import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { ShopSourcingError, ShopSourcingService } from '@/services/ShopSourcingService';

export async function GET() {
  const auth = await requireStaffPermission('settings:view');
  if (auth.error) return auth.error;
  const shops = await ShopSourcingService.listShops();
  return NextResponse.json({ items: shops });
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('settings:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const shop = await ShopSourcingService.upsertShop({
      name: String(body.name ?? ''),
      phone: String(body.phone ?? ''),
      address: String(body.address ?? ''),
      city: String(body.city ?? ''),
      active: body.active !== false,
    });
    return NextResponse.json(shop, { status: 201 });
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not save shop' }, { status: 400 });
  }
}
