import { NextRequest, NextResponse } from 'next/server';
import type { OrderStatus } from '@prisma/client';
import { requireStaffPermission } from '@/lib/staff-auth';
import { OrderService } from '@/services/OrderService';
import { requireSameOrigin } from '@/lib/security';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('orders:view');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await OrderService.list({
    search: searchParams.get('search') || undefined,
    status: (searchParams.get('status') as OrderStatus) || undefined,
    assignedStaffId: searchParams.get('assignedStaffId') || undefined,
    activeOnly: searchParams.get('activeOnly') === '1',
    page: Number(searchParams.get('page') || 1),
    pageSize: Number(searchParams.get('pageSize') || 20),
    includeHistory: searchParams.get('includeHistory') === '1',
  });

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffPermission('orders:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json();
  const { id, status, priority, adminNotes } = body;
  if (!id) return NextResponse.json({ error: 'Order id required' }, { status: 400 });

  try {
    const order = await OrderService.update(
      id,
      { status, priority, adminNotes },
      { id: auth.staff!.id, role: auth.staff!.role, permissions: auth.staff!.permissions },
    );
    return NextResponse.json(order);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
