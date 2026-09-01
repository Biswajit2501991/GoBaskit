import { NextResponse } from 'next/server';
import { WeatherDisclaimerService } from '@/services/WeatherDisclaimerService';

/** Pulls Open-Meteo rain for PIN 723121. Called by health-check about every 20 min. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get('x-cron-secret');
  if (!secret || header !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await WeatherDisclaimerService.refreshFromForecast();
  return NextResponse.json(result);
}
