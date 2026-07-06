import {
  buildProductPricingData,
  calculateDiscountPercent,
  getListPrice,
  getSellingPrice,
} from '@/utils/pricing';

describe('product pricing', () => {
  it('calculates discount from actual and current price', () => {
    expect(calculateDiscountPercent(45, 40)).toBe(11.11);
  });

  it('returns no discount when actual price is empty', () => {
    expect(calculateDiscountPercent(null, 40)).toBe(0);
    expect(getListPrice(null, 40)).toBeNull();
  });

  it('uses current price as selling price when actual is not set', () => {
    const pricing = buildProductPricingData({ price: 40, actualPrice: null });
    expect(pricing).toEqual({ price: 40, actualPrice: null, discount: 0 });
    expect(getSellingPrice(40)).toBe(40);
  });

  it('stores actual price only when higher than selling price', () => {
    const pricing = buildProductPricingData({ price: 40, actualPrice: 45 });
    expect(pricing.price).toBe(40);
    expect(pricing.actualPrice).toBe(45);
    expect(pricing.discount).toBe(11.11);
  });
});
