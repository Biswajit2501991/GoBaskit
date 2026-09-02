import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { OrderFeedbackService } from '@/services/OrderFeedbackService';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('orders:view');
  if (auth.error) return auth.error;

  const page = Number(req.nextUrl.searchParams.get('page') || '1');
  const starsRaw = req.nextUrl.searchParams.get('stars');
  const stars = starsRaw ? Number(starsRaw) : undefined;

  const data = await OrderFeedbackService.listAdmin({
    page: Number.isFinite(page) ? page : 1,
    stars: stars && stars >= 1 && stars <= 5 ? stars : undefined,
  });
  return NextResponse.json(data);
}
