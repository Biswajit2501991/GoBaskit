import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { OrderArchiveService } from '@/services/OrderArchiveService';

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
