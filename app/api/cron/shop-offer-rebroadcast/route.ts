import { NextResponse } from 'next/server';
import { ShopSourcingService } from '@/services/ShopSourcingService';

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get('x-cron-secret');
  if (!secret || header !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await ShopSourcingService.expireAndRebroadcast();
  return NextResponse.json(result);
}
