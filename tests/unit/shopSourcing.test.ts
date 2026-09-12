import {
  fulfillmentTicket,
  isFourDigitPin,
  nextFulfillmentSuffix,
  parseFulfillmentLineCosts,
  parseShopSourcing,
  planShopCatalogSync,
  shopHistorySince,
} from '@/lib/shopSourcing';

describe('shop sourcing helpers', () => {
  it('defaults the feature off', () => {
    expect(parseShopSourcing(undefined).enabled).toBe(false);
    expect(parseShopSourcing({ enabled: true, maxShopsPerItem: 5 }).maxShopsPerItem).toBe(5);
    expect(parseShopSourcing({ maxShopsPerItem: 99 }).maxShopsPerItem).toBe(10);
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
