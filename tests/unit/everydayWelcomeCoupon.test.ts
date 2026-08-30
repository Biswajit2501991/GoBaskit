const prismaMock = {
  coupon: { findUnique: jest.fn() },
  couponUsage: { count: jest.fn() },
  order: { count: jest.fn() },
};

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/services/SettingsService', () => ({
  SettingsService: { getStoreConfig: jest.fn() },
}));
jest.mock('@/services/ActionPlusMembershipClient', () => ({
  ActionPlusMembershipClient: {},
}));

import { DiscountEngine } from '@/services/DiscountEngine';
import { SettingsService } from '@/services/SettingsService';

const welcomeCoupon = {
  id: 'c1',
  couponCode: 'GOBASKIT10',
  discountType: 'PERCENTAGE' as const,
  discountValue: 10,
  maxDiscount: null,
  minimumOrder: 0,
  startDate: null,
  expiryDate: null,
  status: 'ACTIVE' as const,
  usageLimitPerMobile: 1,
  totalUsageLimit: null,
};

describe('GOBASKIT10 new-customer coupon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SettingsService.getStoreConfig as jest.Mock).mockResolvedValue({
      discountConfig: { couponsEnabled: true },
    });
    prismaMock.coupon.findUnique.mockResolvedValue(welcomeCoupon);
    prismaMock.couponUsage.count.mockResolvedValue(0);
  });

  it('rejects returning customers', async () => {
    prismaMock.order.count.mockResolvedValue(2);
    const result = await DiscountEngine.validateCoupon({
      code: 'GOBASKIT10',
      subtotal: 200,
      mobile: '9876543210',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('NEW_CUSTOMER');
    }
  });

  it('applies 10% for a logged-in first-time customer', async () => {
    prismaMock.order.count.mockResolvedValue(0);
    const result = await DiscountEngine.validateCoupon({
      code: 'GOBASKIT10',
      subtotal: 200,
      mobile: '9876543210',
    });
    expect(result).toMatchObject({ ok: true, discountAmount: 20, couponCode: 'GOBASKIT10' });
  });

  it('does not apply the new-customer rule to other codes', async () => {
    prismaMock.coupon.findUnique.mockResolvedValue({
      ...welcomeCoupon,
      couponCode: 'FREEDOM10',
    });
    const result = await DiscountEngine.validateCoupon({
      code: 'FREEDOM10',
      subtotal: 200,
      mobile: '9876543210',
    });
    expect(result.ok).toBe(true);
    expect(prismaMock.order.count).not.toHaveBeenCalled();
  });
});
