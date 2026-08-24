import { parseSeasonalThemeId, SEASONAL_THEME_IDS } from '@/constants/seasonalThemes';

describe('seasonal theme ids', () => {
  it('keeps Independence Day and Raksha Bandhan as selectable skins', () => {
    expect(SEASONAL_THEME_IDS).toEqual(['independence-day', 'raksha-bandhan']);
  });

  it('falls back to Independence Day for unknown or missing ids without throwing', () => {
    expect(parseSeasonalThemeId('independence-day')).toBe('independence-day');
    expect(parseSeasonalThemeId('raksha-bandhan')).toBe('raksha-bandhan');
    expect(parseSeasonalThemeId('diwali')).toBe('independence-day');
    expect(parseSeasonalThemeId(undefined)).toBe('independence-day');
    expect(parseSeasonalThemeId(null)).toBe('independence-day');
  });
});
