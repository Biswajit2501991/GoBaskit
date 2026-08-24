import {
  persistStorefrontPresentation,
  readStorefrontPresentation,
  STOREFRONT_PRESENTATION_KEY,
} from '@/utils/storefrontPresentation';

describe('storefront presentation snapshot', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a valid seasonal skin', () => {
    persistStorefrontPresentation({
      seasonalThemeEnabled: true,
      seasonalThemeId: 'raksha-bandhan',
    });
    expect(readStorefrontPresentation()).toEqual({
      seasonalThemeEnabled: true,
      seasonalThemeId: 'raksha-bandhan',
    });
    expect(window.localStorage.getItem(STOREFRONT_PRESENTATION_KEY)).toContain('raksha-bandhan');
  });

  it('rejects unknown theme ids without throwing', () => {
    window.localStorage.setItem(
      STOREFRONT_PRESENTATION_KEY,
      JSON.stringify({ seasonalThemeEnabled: true, seasonalThemeId: 'diwali' }),
    );
    expect(readStorefrontPresentation()).toBeNull();
  });
});
