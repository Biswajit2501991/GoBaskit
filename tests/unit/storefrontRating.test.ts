import {
  parseStorefrontRating,
  storefrontDisplayCount,
  withStorefrontDisplayCount,
} from '@/lib/storefrontRating';

describe('storefront rating display', () => {
  it('defaults off with a staff-owned 4.9 score', () => {
    expect(parseStorefrontRating(undefined)).toEqual({
      enabled: false,
      score: 4.9,
      seedCount: 0,
    });
    expect(parseStorefrontRating({ enabled: true, score: 4.87, seedCount: 249 }).score).toBe(4.9);
    expect(parseStorefrontRating({ seedCount: -4 }).seedCount).toBe(0);
  });

  it('adds 10 to the public count for each real rating', () => {
    expect(storefrontDisplayCount(249, 0)).toBe(249);
    expect(storefrontDisplayCount(249, 2)).toBe(269);
    expect(withStorefrontDisplayCount({ enabled: true, score: 4.9, seedCount: 249 }, 1)).toEqual({
      enabled: true,
      score: 4.9,
      seedCount: 249,
      displayCount: 259,
    });
  });
});
