import { parsePartnerDelivery } from '@/lib/partnerDelivery';

describe('partner delivery settings', () => {
  it('defaults off until explicitly enabled', () => {
    expect(parsePartnerDelivery(undefined).enabled).toBe(false);
    expect(parsePartnerDelivery('false').enabled).toBe(false);
    expect(parsePartnerDelivery({}).enabled).toBe(false);
    expect(parsePartnerDelivery('true').enabled).toBe(true);
    expect(parsePartnerDelivery({ enabled: true }).enabled).toBe(true);
  });
});
