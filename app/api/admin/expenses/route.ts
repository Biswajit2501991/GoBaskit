import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { ExpenseService } from '@/services/ExpenseService';
import { AuditService } from '@/services/AuditService';
import { istYmd } from '@/lib/istDay';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('finance:view');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const today = istYmd();
  const from = searchParams.get('from') || today;
  const to = searchParams.get('to') || today;
  const q = searchParams.get('q') ?? undefined;
  try {
    const data = await ExpenseService.list({ from, to, q });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load expenses';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('finance:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json().catch(() => null);
  try {
    const item = await ExpenseService.create(body, auth.staff?.id);
    await AuditService.log({
      staffId: auth.staff?.id,
      action: 'expense_created',
      entity: 'expenses',
      entityId: item.id,
      meta: { amount: item.amount, category: item.category },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add expense';
    const status = message === 'Add Expense is turned off' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffPermission('settings:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    expensesEnabled?: unknown;
    showTotalProfitEnabled?: unknown;
  } | null;
  const patch: { expensesEnabled?: boolean; showTotalProfitEnabled?: boolean } = {};
  if (typeof body?.expensesEnabled === 'boolean') patch.expensesEnabled = body.expensesEnabled;
  if (typeof body?.showTotalProfitEnabled === 'boolean') {
    patch.showTotalProfitEnabled = body.showTotalProfitEnabled;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No toggle provided' }, { status: 400 });
  }
  await ExpenseService.setFlags(patch);
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'expense_flags_toggle',
    entity: 'settings',
    meta: patch,
  });
  return NextResponse.json(await ExpenseService.flags());
}
