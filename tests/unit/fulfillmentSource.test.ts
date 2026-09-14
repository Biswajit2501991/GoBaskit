import { coerceFulfillmentSource, parseCostPrice, parseFulfillmentSource, snapshotFulfillment } from '@/lib/fulfillmentSource';

describe('fulfillmentSource helpers', () => {
  it('parses common labels and skips unknown values', () => {
    expect(parseFulfillmentSource('in house')).toBe('IN_HOUSE');
    expect(parseFulfillmentSource('Outsourced')).toBe('OUTSOURCE');
    expect(parseFulfillmentSource('')).toBe('UNSET');
    expect(parseFulfillmentSource('warehouse')).toBeNull();
    expect(coerceFulfillmentSource('warehouse')).toBe('UNSET');
  });

  it('parses cost price and snapshots variant over product', () => {
    expect(parseCostPrice('12.555')).toBe(12.56);
    expect(parseCostPrice('')).toBeNull();
    expect(
      snapshotFulfillment({
        productSource: 'IN_HOUSE',
        productCost: 10,
        variantSource: 'OUTSOURCE',
        variantCost: 8,
      }),
    ).toEqual({ fulfillmentSource: 'OUTSOURCE', costPriceSnapshot: 8 });
    expect(
      snapshotFulfillment({
        productSource: 'IN_HOUSE',
        productCost: 10,
        variantSource: 'UNSET',
        variantCost: null,
      }),
    ).toEqual({ fulfillmentSource: 'IN_HOUSE', costPriceSnapshot: 10 });
  });
});
