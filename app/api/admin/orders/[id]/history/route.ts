import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { OrderService } from '@/services/OrderService';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffPermission('orders:view');
  if (auth.error) return auth.error;

  const { id } = await params;
  const history = await OrderService.getStatusHistory(id);
  return NextResponse.json({
    items: history.map((h) => ({
      id: h.id,
      status: h.status,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
      staff: h.staff,
    })),
  });
}
