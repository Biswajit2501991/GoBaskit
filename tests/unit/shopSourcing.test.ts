import {
  fulfillmentTicket,
  isFourDigitPin,
  nextFulfillmentSuffix,
  parseFulfillmentLineCosts,
  parseShopSourcing,
  planShopCatalogSync,
  nextCatalogSellingPrice,
  isSixDigitPin,
  shopHistorySince,
} from '@/lib/shopSourcing';

describe('shop sourcing helpers', () => {
  it('defaults the feature off', () => {
    expect(parseShopSourcing(undefined).enabled).toBe(false);
    expect(parseShopSourcing(undefined).outsourceAutoStockEnabled).toBe(false);
    expect(parseShopSourcing(undefined).outsourceRefillAt).toBe(5);
    expect(parseShopSourcing(undefined).outsourceRefillTo).toBe(30);
    expect(parseShopSourcing({ enabled: true, maxShopsPerItem: 5 }).maxShopsPerItem).toBe(5);
    expect(parseShopSourcing({ maxShopsPerItem: 99 }).maxShopsPerItem).toBe(10);
    expect(parseShopSourcing({ offerTimeoutSeconds: 90 }).offerTimeoutSeconds).toBe(300);
    expect(parseShopSourcing({ offerTimeoutSeconds: 120 }).offerTimeoutSeconds).toBe(120);
    expect(parseShopSourcing(undefined).offerTimeoutSeconds).toBe(300);
  });

  it('assigns A then B suffixes', () => {
    expect(nextFulfillmentSuffix(0)).toBe('A');
    expect(nextFulfillmentSuffix(1)).toBe('B');
    expect(fulfillmentTicket('GBABC', 'A')).toBe('GBABC-A');
  });

  it('keeps shop history to the last 30 days', () => {
    const now = new Date('2026-09-11T12:00:00.000Z');
    const since = shopHistorySince(now);
    expect(now.getTime() - since.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('accepts a 4-digit PIN that is not 0000', () => {
    expect(isFourDigitPin('4821')).toBe(true);
    expect(isFourDigitPin('0000')).toBe(false);
    expect(isFourDigitPin('12')).toBe(false);
  });

  it('syncs one shop without dropping other shops, and skips items already at the cap', () => {
    const plan = planShopCatalogSync({
      currentProductIds: ['keep', 'drop'],
      wantedProductIds: ['keep', 'add', 'full'],
      otherShopCountByProduct: { add: 1, full: 3 },
      maxShopsPerItem: 3,
    });
    expect(plan.add).toEqual(['add']);
    expect(plan.remove).toEqual(['drop']);
    expect(plan.skipped).toEqual(['full']);
  });
});

describe('nextCatalogSellingPrice', () => {
  it('raises site price to shop unit plus 3 when margin is under 3', () => {
    expect(nextCatalogSellingPrice(70, 68)).toBe(71);
    expect(nextCatalogSellingPrice(70, 67)).toBe(70);
    expect(nextCatalogSellingPrice(70, 75)).toBe(78);
    expect(nextCatalogSellingPrice(70, 68)).toBeGreaterThanOrEqual(70);
  });
});

describe('isSixDigitPin', () => {
  it('accepts 6-digit codes except 000000', () => {
    expect(isSixDigitPin('482193')).toBe(true);
    expect(isSixDigitPin('000000')).toBe(false);
    expect(isSixDigitPin('1234')).toBe(false);
  });
});

describe('parseFulfillmentLineCosts', () => {
  it('sums every line and rejects missing or unknown items', () => {
    const ok = parseFulfillmentLineCosts(
      [
        { id: 'a', costToGobaskit: 10.555 },
        { id: 'b', costToGobaskit: 2 },
      ],
      ['a', 'b'],
    );
    expect(ok).toEqual({
      ok: true,
      lines: [
        { id: 'a', costToGobaskit: 10.56 },
        { id: 'b', costToGobaskit: 2 },
      ],
      total: 12.56,
    });
    expect(parseFulfillmentLineCosts([{ id: 'a', costToGobaskit: 1 }], ['a', 'b']).ok).toBe(false);
    expect(parseFulfillmentLineCosts([{ id: 'z', costToGobaskit: 1 }], ['a']).ok).toBe(false);
    expect(parseFulfillmentLineCosts([{ id: 'a', costToGobaskit: -1 }], ['a']).ok).toBe(false);
  });
});
