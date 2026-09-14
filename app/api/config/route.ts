import { NextResponse } from 'next/server';
import { SettingsService } from '@/services/SettingsService';
import { OrderFeedbackService } from '@/services/OrderFeedbackService';
import { withStorefrontDisplayCount } from '@/lib/storefrontRating';

/** Live delivery fees / PINs — never serve a build-time or CDN-cached snapshot. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Public store config for the client (serviceable PINs, delivery slabs, min order).
// Served from the SettingsService in-memory cache, so it does not add DB load per request.
export async function GET() {
  const config = await SettingsService.getStoreConfig();
  const { profitDashboardEnabled: _profitDashboardEnabled, ...publicConfig } = config;
  const ratedCount = config.storefrontRating.enabled
    ? (await OrderFeedbackService.ratingSummary()).ratedCount
    : 0;
  return NextResponse.json(
    {
      ...publicConfig,
      storefrontRating: withStorefrontDisplayCount(config.storefrontRating, ratedCount),
    },
    {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
      },
    },
  );
}
