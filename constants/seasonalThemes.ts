export const SEASONAL_THEME_IDS = ['independence-day', 'raksha-bandhan'] as const;

export type SeasonalThemeId = (typeof SEASONAL_THEME_IDS)[number];

export const DEFAULT_SEASONAL_THEME_ID: SeasonalThemeId = 'independence-day';

export const SEASONAL_THEME_OPTIONS: Array<{
  id: SeasonalThemeId;
  label: string;
  description: string;
}> = [
  {
    id: 'independence-day',
    label: 'Independence Day (15 August)',
    description: 'Tricolor header wash, saffron–green ribbon',
  },
  {
    id: 'raksha-bandhan',
    label: 'Raksha Bandhan',
    description: 'Forest-green header, cream banners, rakhi red–gold accents',
  },
];

/** Suggested storefront copy — admin can override; never auto-overwrite custom text on save. */
export const SEASONAL_THEME_COPY: Record<
  SeasonalThemeId,
  { ribbon: string; promoTitle: string; promoSubtitle: string }
> = {
  'independence-day': {
    ribbon: 'Celebrating 15 August · Order fresh essentials today',
    promoTitle: 'Freedom Day Offer',
    promoSubtitle: 'Apply this code in cart after login for 10% off',
  },
  'raksha-bandhan': {
    ribbon: 'Happy Raksha Bandhan · Bhai-Behen Ki Celebration, Snacks & Essentials Ke Saath!',
    promoTitle: 'Raksha Bandhan Special',
    promoSubtitle: 'Flat 10% OFF on orders above ₹499 · Apply code in cart',
  },
};

export function isSeasonalThemeId(value: unknown): value is SeasonalThemeId {
  return typeof value === 'string' && (SEASONAL_THEME_IDS as readonly string[]).includes(value);
}

/** Unknown or missing ids fall back to Independence Day — never drop other homepage settings. */
export function parseSeasonalThemeId(value: unknown): SeasonalThemeId {
  return isSeasonalThemeId(value) ? value : DEFAULT_SEASONAL_THEME_ID;
}
