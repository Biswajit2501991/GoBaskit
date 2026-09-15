import { NextResponse } from 'next/server';
import { SettingsService } from '@/services/SettingsService';

/** Live delivery fees / PINs — never serve a build-time or CDN-cached snapshot. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Public store config for the client (serviceable PINs, delivery slabs, min order).
// Served from the SettingsService in-memory cache, so it does not add DB load per request.
export async function GET() {
  const config = await SettingsService.getStoreConfig();
  const storefrontRating = await SettingsService.getPublicStorefrontRating();
  const {
    profitDashboardEnabled: _profitDashboardEnabled,
    expensesEnabled: _expensesEnabled,
    showTotalProfitEnabled: _showTotalProfitEnabled,
    ...publicConfig
  } = config;
  return NextResponse.json(
    {
      ...publicConfig,
      storefrontRating,
    },
    {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
      },
    },
  );
}
