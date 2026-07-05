import { NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { OrderService } from '@/services/OrderService';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffPermission('orders:edit');
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const order = await OrderService.release(id, {
      id: auth.staff!.id,
      role: auth.staff!.role,
      permissions: auth.staff!.permissions,
    });
    return NextResponse.json(order);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Release failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
