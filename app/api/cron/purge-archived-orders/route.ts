import { NextResponse } from 'next/server';
import { OrderArchiveService } from '@/services/OrderArchiveService';

/** Internal purge endpoint — called by health-check cron. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get('x-cron-secret');
  if (!secret || header !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await OrderArchiveService.purgeExpiredOrders();
  return NextResponse.json(result);
}
