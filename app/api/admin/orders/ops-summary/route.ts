import { NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { OrderService } from '@/services/OrderService';

export async function GET() {
  const auth = await requireStaffPermission('orders:view');
  if (auth.error) return auth.error;

  const data = await OrderService.getOpsSummary();
  return NextResponse.json(data);
}
