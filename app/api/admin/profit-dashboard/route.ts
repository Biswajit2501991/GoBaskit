import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { ProfitDashboardService } from '@/services/ProfitDashboardService';
import { AuditService } from '@/services/AuditService';

function parseDayStart(raw: string | null): Date | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDayEnd(raw: string | null): Date | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T23:59:59.999`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('finance:view');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const includeDelivery = searchParams.get('includeDelivery') !== '0';
  const orderId = searchParams.get('orderId');
  if (orderId) {
    const detail = await ProfitDashboardService.orderDetail(orderId, includeDelivery);
    return NextResponse.json(detail);
  }

  const today = new Date();
  const from =
    parseDayStart(searchParams.get('from')) ??
    new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const to = parseDayEnd(searchParams.get('to')) ?? new Date();
  const data = await ProfitDashboardService.overview({ from, to, includeDelivery });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffPermission('settings:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json().catch(() => null) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be true or false' }, { status: 400 });
  }
  await ProfitDashboardService.setEnabled(body.enabled);
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'profit_dashboard_toggle',
    entity: 'settings',
    meta: { enabled: body.enabled },
  });
  return NextResponse.json({ enabled: body.enabled });
}
