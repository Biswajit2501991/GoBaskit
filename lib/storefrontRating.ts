export type StorefrontRatingConfig = {
  enabled: boolean;
  /** Staff-owned score shown on the site (1.0–5.0). */
  score: number;
  /** Staff-owned starting count. Live public count = seed + rated reviews × 10. */
  seedCount: number;
};

export const STOREFRONT_RATING_PER_REVIEW = 10;

export const DEFAULT_STOREFRONT_RATING: StorefrontRatingConfig = {
  enabled: false,
  score: 4.9,
  seedCount: 0,
};

function clampScore(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(5, Math.max(1, n)) * 10) / 10;
}

function clampSeed(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1_000_000, Math.max(0, Math.round(n)));
}

export function parseStorefrontRating(raw: unknown): StorefrontRatingConfig {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    enabled: src.enabled === true,
    score: clampScore(src.score, DEFAULT_STOREFRONT_RATING.score),
    seedCount: clampSeed(src.seedCount, DEFAULT_STOREFRONT_RATING.seedCount),
  };
}

export function storefrontDisplayCount(seedCount: number, ratedCount: number): number {
  const seed = clampSeed(seedCount, 0);
  const rated = Number.isFinite(Number(ratedCount)) ? Math.max(0, Math.floor(Number(ratedCount))) : 0;
  return seed + rated * STOREFRONT_RATING_PER_REVIEW;
}

export type StorefrontRatingPublic = StorefrontRatingConfig & {
  displayCount: number;
};

export function withStorefrontDisplayCount(
  config: StorefrontRatingConfig,
  ratedCount: number,
): StorefrontRatingPublic {
  const parsed = parseStorefrontRating(config);
  return {
    ...parsed,
    displayCount: storefrontDisplayCount(parsed.seedCount, ratedCount),
  };
}

export function formatStorefrontScore(score: number): string {
  return clampScore(score, DEFAULT_STOREFRONT_RATING.score).toFixed(1);
}
