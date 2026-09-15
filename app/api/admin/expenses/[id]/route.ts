import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { ExpenseService } from '@/services/ExpenseService';
import { AuditService } from '@/services/AuditService';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('finance:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  try {
    const item = await ExpenseService.update(id, body);
    if (!item) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    await AuditService.log({
      staffId: auth.staff?.id,
      action: 'expense_updated',
      entity: 'expenses',
      entityId: id,
    });
    return NextResponse.json(item);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update expense';
    const status = message === 'Add Expense is turned off' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('finance:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  try {
    const ok = await ExpenseService.softDelete(id);
    if (!ok) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    await AuditService.log({
      staffId: auth.staff?.id,
      action: 'expense_deleted',
      entity: 'expenses',
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove expense';
    const status = message === 'Add Expense is turned off' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
