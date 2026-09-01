import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { WeatherDisclaimerService } from '@/services/WeatherDisclaimerService';
import { SettingsService } from '@/services/SettingsService';

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('settings:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  await WeatherDisclaimerService.refreshFromForecast();
  const config = await SettingsService.getStoreConfig();
  return NextResponse.json(config.weatherDisclaimer);
}
