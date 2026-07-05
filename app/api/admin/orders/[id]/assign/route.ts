import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { OrderService } from '@/services/OrderService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffPermission('orders:assign');
  if (auth.error) return auth.error;

  const { id } = await params;
  const { staffId } = await req.json();
  if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 });

  try {
    const order = await OrderService.assign(id, staffId, auth.staff!.id);
    return NextResponse.json(order);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Assign failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
