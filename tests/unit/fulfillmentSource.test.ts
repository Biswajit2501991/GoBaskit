import { coerceFulfillmentSource, decideFulfillmentRoute, isShopOfferLine, parseCostPrice, parseFulfillmentSource, shouldReserveWarehouseStock, snapshotFulfillment } from '@/lib/fulfillmentSource';

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

  it('routes In House OOS to shops without changing the catalog tag helper', () => {
    expect(
      decideFulfillmentRoute({
        source: 'IN_HOUSE',
        availableStock: 4,
        quantity: 2,
        shopSourcingEnabled: true,
      }),
    ).toBe('IN_HOUSE');
    expect(
      decideFulfillmentRoute({
        source: 'IN_HOUSE',
        availableStock: 0,
        quantity: 2,
        shopSourcingEnabled: true,
      }),
    ).toBe('SHOP');
    expect(
      decideFulfillmentRoute({
        source: 'IN_HOUSE',
        availableStock: 0,
        quantity: 2,
        shopSourcingEnabled: false,
      }),
    ).toBe('IN_HOUSE');
    expect(
      decideFulfillmentRoute({
        source: 'OUTSOURCE',
        availableStock: 0,
        quantity: 2,
        shopSourcingEnabled: true,
      }),
    ).toBe('SHOP');
    expect(
      shouldReserveWarehouseStock({ fulfillmentSource: 'IN_HOUSE', fulfillmentRoute: 'SHOP' }),
    ).toBe(false);
    expect(
      shouldReserveWarehouseStock({ fulfillmentSource: 'OUTSOURCE', fulfillmentRoute: 'SHOP' }),
    ).toBe(true);
    expect(isShopOfferLine({ fulfillmentRoute: 'IN_HOUSE', hasShopTags: true })).toBe(false);
    expect(isShopOfferLine({ fulfillmentRoute: 'SHOP', hasShopTags: true })).toBe(true);
    expect(isShopOfferLine({ fulfillmentRoute: null, hasShopTags: true })).toBe(true);
  });
});
