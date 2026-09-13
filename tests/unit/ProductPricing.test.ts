import {
  buildProductPricingData,
  calculateDiscountPercent,
  calculateDiscountPercentage,
  getListPrice,
  getSellingPrice,
  formatDiscountBadge,
  shiftSellingPriceHistory,
} from '@/utils/pricing';

describe('product pricing', () => {
  it('calculates discount from actual and current price', () => {
    expect(calculateDiscountPercent(45, 40)).toBe(11);
    expect(calculateDiscountPercentage(240, 220)).toBe(8);
    expect(calculateDiscountPercentage(100, 70)).toBe(30);
  });

  it('returns no discount when prices are equal or mrp missing', () => {
    expect(calculateDiscountPercent(null, 40)).toBe(0);
    expect(calculateDiscountPercentage(220, 220)).toBe(0);
    expect(calculateDiscountPercentage(200, 220)).toBe(0);
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
    expect(pricing.discount).toBe(11);
  });

  it('formats discount badge only when mrp exceeds price', () => {
    expect(formatDiscountBadge(240, 220)).toBe('8% OFF');
    expect(formatDiscountBadge(220, 220)).toBeNull();
    expect(formatDiscountBadge(null, 220)).toBeNull();
  });

  it('keeps the last two selling prices when the live price changes', () => {
    const first = shiftSellingPriceHistory({
      currentPrice: 70,
      nextPrice: 75,
      previousPrice: null,
      earlierPrice: null,
    });
    expect(first.previousPrice).toBe(70);
    expect(first.earlierPrice).toBeNull();

    const second = shiftSellingPriceHistory({
      currentPrice: 75,
      nextPrice: 80,
      previousPrice: first.previousPrice,
      earlierPrice: first.earlierPrice,
    });
    expect(second.previousPrice).toBe(75);
    expect(second.earlierPrice).toBe(70);

    const unchanged = shiftSellingPriceHistory({
      currentPrice: 80,
      nextPrice: 80,
      previousPrice: second.previousPrice,
      earlierPrice: second.earlierPrice,
    });
    expect(unchanged.previousPrice).toBe(75);
    expect(unchanged.earlierPrice).toBe(70);
  });
});
