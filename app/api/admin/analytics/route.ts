import { NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { AnalyticsService } from '@/services/AnalyticsService';

export async function GET() {
  const auth = await requireStaffPermission('analytics:view');
  if (auth.error) return auth.error;

  const data = await AnalyticsService.getOverview();
  return NextResponse.json(data);
}
