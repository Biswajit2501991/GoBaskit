import { NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { ExpenseService } from '@/services/ExpenseService';

export async function GET() {
  const auth = await requireStaffPermission('finance:view');
  if (auth.error) return auth.error;
  const data = await ExpenseService.todayChip();
  return NextResponse.json(data);
}
