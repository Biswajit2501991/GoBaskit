import { isSeasonalThemeId, type SeasonalThemeId } from '@/constants/seasonalThemes';

export const STOREFRONT_PRESENTATION_KEY = 'gobaskit.storefront.v1';

export type StorefrontPresentation = {
  seasonalThemeEnabled: boolean;
  seasonalThemeId: SeasonalThemeId;
};

export function persistStorefrontPresentation(snapshot: StorefrontPresentation): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STOREFRONT_PRESENTATION_KEY, JSON.stringify(snapshot));
  } catch {
    /* private mode / quota */
  }
}

export function readStorefrontPresentation(): StorefrontPresentation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STOREFRONT_PRESENTATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StorefrontPresentation>;
    if (!isSeasonalThemeId(parsed.seasonalThemeId)) return null;
    return {
      seasonalThemeEnabled: parsed.seasonalThemeEnabled === true,
      seasonalThemeId: parsed.seasonalThemeId,
    };
  } catch {
    return null;
  }
}
