import { NextResponse } from 'next/server';
import { UnassignedOrderReminderService } from '@/services/UnassignedOrderReminderService';

/** Reminds staff about still-unassigned orders. Called by health-check every ~10 min. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get('x-cron-secret');
  if (!secret || header !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await UnassignedOrderReminderService.remindDue();
  return NextResponse.json(result);
}
