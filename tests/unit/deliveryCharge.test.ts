import { deliveryChargeFrom, DELIVERY_SLABS } from '@/constants';

describe('deliveryChargeFrom', () => {
  it('uses default slabs including ₹20 for ₹200–299', () => {
    expect(deliveryChargeFrom(DELIVERY_SLABS, 150)).toBe(10);
    expect(deliveryChargeFrom(DELIVERY_SLABS, 250)).toBe(20);
    expect(deliveryChargeFrom(DELIVERY_SLABS, 400)).toBe(30);
  });

  it('applies admin-saved charges instead of the code defaults', () => {
    const saved = [
      { min: 0, max: 199, charge: 10 },
      { min: 200, max: 299, charge: 25 },
      { min: 300, max: 499, charge: 30 },
      { min: 500, max: 1000, charge: 50 },
      { min: 1001, max: 2000, charge: 70 },
      { min: 2001, max: 100000000, charge: 100 },
    ];
    expect(deliveryChargeFrom(saved, 250)).toBe(25);
    expect(deliveryChargeFrom(saved, 200)).toBe(25);
    expect(deliveryChargeFrom(saved, 199)).toBe(10);
  });
});
