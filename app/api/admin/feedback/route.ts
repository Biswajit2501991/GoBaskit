import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { OrderFeedbackService } from '@/services/OrderFeedbackService';
import { SettingsService } from '@/services/SettingsService';
import { parseStorefrontRating, withStorefrontDisplayCount } from '@/lib/storefrontRating';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('orders:view');
  if (auth.error) return auth.error;

  const page = Number(req.nextUrl.searchParams.get('page') || '1');
  const starsRaw = req.nextUrl.searchParams.get('stars');
  const stars = starsRaw ? Number(starsRaw) : undefined;

  const [data, config] = await Promise.all([
    OrderFeedbackService.listAdmin({
      page: Number.isFinite(page) ? page : 1,
      stars: stars && stars >= 1 && stars <= 5 ? stars : undefined,
    }),
    SettingsService.getStoreConfig(),
  ]);
  return NextResponse.json({
    ...data,
    storefrontRating: withStorefrontDisplayCount(config.storefrontRating, data.ratedCount),
  });
}

const displaySchema = z.object({
  enabled: z.boolean().optional(),
  score: z.number().min(1).max(5).optional(),
  seedCount: z.number().int().min(0).max(1_000_000).optional(),
});

export async function PUT(req: NextRequest) {
  const auth = await requireStaffPermission('orders:view', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = displaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a score between 1 and 5, and a count of 0 or more.' }, { status: 400 });
  }

  const saved = await SettingsService.updateStoreConfig({
    storefrontRating: parseStorefrontRating({
      ...(await SettingsService.getStoreConfig()).storefrontRating,
      ...parsed.data,
    }),
  });
  const summary = await OrderFeedbackService.ratingSummary();
  return NextResponse.json({
    storefrontRating: withStorefrontDisplayCount(saved.storefrontRating, summary.ratedCount),
    ratedCount: summary.ratedCount,
    averageStars: summary.averageStars,
  });
}
