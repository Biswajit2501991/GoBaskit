import { getTrackingHeadline, getTrackingStepIndex, isActiveOrderStatus } from '@/utils/orderTracking';

describe('orderTracking', () => {
  it('maps statuses to progress steps', () => {
    expect(getTrackingStepIndex('PENDING')).toBe(0);
    expect(getTrackingStepIndex('ACCEPTED')).toBe(0);
    expect(getTrackingStepIndex('PACKED')).toBe(1);
    expect(getTrackingStepIndex('OUT_FOR_DELIVERY')).toBe(2);
    expect(getTrackingStepIndex('DELIVERED')).toBe(3);
    expect(getTrackingStepIndex('CANCELLED')).toBe(-1);
  });

  it('identifies active orders', () => {
    expect(isActiveOrderStatus('PACKED')).toBe(true);
    expect(isActiveOrderStatus('DELIVERED')).toBe(false);
    expect(isActiveOrderStatus('CANCELLED')).toBe(false);
  });

  it('returns headlines', () => {
    expect(getTrackingHeadline('CANCELLED')).toMatch(/cancelled/i);
    expect(getTrackingHeadline('DELIVERED')).toMatch(/delivered/i);
  });
});
