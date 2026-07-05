import { NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { DashboardService } from '@/services/DashboardService';

export async function GET() {
  const auth = await requireStaffPermission('analytics:view');
  if (auth.error) return auth.error;

  const stats = await DashboardService.getStats();
  return NextResponse.json(stats);
}
