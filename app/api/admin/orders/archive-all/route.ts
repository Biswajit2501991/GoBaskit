import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { OrderArchiveService } from '@/services/OrderArchiveService';
import { requireSameOrigin } from '@/lib/security';

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('orders:delete');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  try {
    const result = await OrderArchiveService.archiveAllOrders(auth.staff!.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Archive failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
