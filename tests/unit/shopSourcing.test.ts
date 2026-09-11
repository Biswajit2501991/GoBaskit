import {
  fulfillmentTicket,
  isFourDigitPin,
  nextFulfillmentSuffix,
  parseShopSourcing,
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
});
