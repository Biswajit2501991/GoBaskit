import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { OrderArchiveService } from '@/services/OrderArchiveService';
import { requireSameOrigin } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('orders:view');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await OrderArchiveService.listArchived({
    search: searchParams.get('search') || undefined,
    page: Number(searchParams.get('page') || 1),
    pageSize: Number(searchParams.get('pageSize') || 20),
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('orders:delete');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json().catch(() => null);
  const orderIds = Array.isArray(body?.orderIds)
    ? body.orderIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    : [];

  try {
    const result = await OrderArchiveService.archiveOrdersByIds(orderIds, auth.staff!.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Archive failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
