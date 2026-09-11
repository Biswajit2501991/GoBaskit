import {
  fulfillmentTicket,
  isFourDigitPin,
  nextFulfillmentSuffix,
  parseShopSourcing,
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

  it('accepts a 4-digit PIN that is not 0000', () => {
    expect(isFourDigitPin('4821')).toBe(true);
    expect(isFourDigitPin('0000')).toBe(false);
    expect(isFourDigitPin('12')).toBe(false);
  });
});
