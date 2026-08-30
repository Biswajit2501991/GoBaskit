import {
  EVERYDAY_WELCOME_COUPON_CODE,
  parseSeasonalThemeId,
  SEASONAL_THEME_COPY,
  SEASONAL_THEME_IDS,
} from '@/constants/seasonalThemes';

describe('seasonal theme ids', () => {
  it('includes Normal plus festival skins', () => {
    expect(SEASONAL_THEME_IDS).toEqual(['normal', 'independence-day', 'raksha-bandhan']);
  });

  it('falls back to Independence Day for unknown or missing ids without throwing', () => {
    expect(parseSeasonalThemeId('normal')).toBe('normal');
    expect(parseSeasonalThemeId('independence-day')).toBe('independence-day');
    expect(parseSeasonalThemeId('raksha-bandhan')).toBe('raksha-bandhan');
    expect(parseSeasonalThemeId('diwali')).toBe('independence-day');
    expect(parseSeasonalThemeId(undefined)).toBe('independence-day');
    expect(parseSeasonalThemeId(null)).toBe('independence-day');
  });

  it('suggests GOBASKIT10 copy for the Normal theme', () => {
    expect(SEASONAL_THEME_COPY.normal.promoCode).toBe(EVERYDAY_WELCOME_COUPON_CODE);
    expect(SEASONAL_THEME_COPY.normal.promoSubtitle.toLowerCase()).toContain('new customer');
  });
});
