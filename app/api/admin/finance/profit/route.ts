import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { FinanceProfitService } from '@/services/FinanceProfitService';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('finance:view');
  if (auth.error) return auth.error;
  const { searchParams } = new URL(req.url);
  const fromRaw = searchParams.get('from');
  const toRaw = searchParams.get('to');
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;
  const data = await FinanceProfitService.overview({
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  });
  return NextResponse.json(data);
}
