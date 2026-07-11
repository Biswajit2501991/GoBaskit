import { e164ToCheckoutMobile, isValidE164, toE164 } from '@/utils/phone';

describe('phone utils — Indian mobile integrity', () => {
  it('rejects short nationals that previously became +91 2607158', () => {
    expect(toE164('91', '2607158')).toBeNull();
    expect(isValidE164('+912607158')).toBe(false);
    expect(e164ToCheckoutMobile('+912607158')).toBe('');
  });

  it('accepts valid 10-digit Indian mobiles', () => {
    expect(toE164('91', '9876543210')).toBe('+919876543210');
    expect(e164ToCheckoutMobile('+919876543210')).toBe('9876543210');
    expect(isValidE164('+919876543210')).toBe(true);
  });

  it('normalizes +91 prefixed 12-digit input without truncating wrongly', () => {
    expect(toE164('91', '919876543210')).toBe('+919876543210');
  });

  it('rejects mobiles that do not start with 6–9', () => {
    expect(toE164('91', '5123456789')).toBeNull();
    expect(toE164('91', '0123456789')).toBeNull();
  });
});
