import { parseDeliveryOtp } from '@/lib/deliveryOtp';

describe('delivery OTP settings', () => {
  it('defaults off until explicitly enabled', () => {
    expect(parseDeliveryOtp(undefined).enabled).toBe(false);
    expect(parseDeliveryOtp('false').enabled).toBe(false);
    expect(parseDeliveryOtp({}).enabled).toBe(false);
    expect(parseDeliveryOtp('true').enabled).toBe(true);
    expect(parseDeliveryOtp({ enabled: true }).enabled).toBe(true);
  });
});
