import { NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { ShopHandoverService } from '@/services/ShopHandoverService';
import { ShopSourcingError } from '@/services/ShopSourcingService';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireStaffPermission('orders:view', { live: true });
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const result = await ShopHandoverService.revealCode(id, auth.staff!);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ShopSourcingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Could not load shop code' }, { status: 400 });
  }
}
