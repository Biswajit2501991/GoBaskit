/** Client-safe Health Star display types/defaults (no Prisma / server imports). */

export type HealthStarDisplayMode = 'stars' | 'badge' | 'both';
export type HealthStarBadgePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface HealthStarDisplay {
  /** stars = yellow stars only; badge = logo on image; both = logo + stars */
  mode: HealthStarDisplayMode;
  /** Where the uploaded logo sits on the product image */
  badgePosition: HealthStarBadgePosition;
  /** Only show the logo overlay when rating >= this (default 5) */
  badgeMinRating: number;
  /** Active badge image URL shown on product images */
  badgeUrl: string;
  /** Uploaded badge library — admin picks which one is active */
  badges: Array<{ id: string; label: string; url: string }>;
}

export const DEFAULT_HEALTH_STAR_DISPLAY: HealthStarDisplay = {
  mode: 'both',
  badgePosition: 'top-right',
  badgeMinRating: 5,
  badgeUrl: '/health-star/health-star-5.png',
  badges: [
    {
      id: 'default-5',
      label: 'Health Star 5',
      url: '/health-star/health-star-5.png',
    },
  ],
};
