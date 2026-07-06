import { toE164, parseE164, isValidE164, e164ToCheckoutMobile } from '@/utils/phone';
import { VERIFICATION_CODE_PREFIX } from '@/constants/whatsappVerification';

describe('phone utils', () => {
  it('builds E.164 for India', () => {
    expect(toE164('91', '9876543210')).toBe('+919876543210');
  });

  it('builds E.164 for Australia', () => {
    expect(toE164('61', '412345678')).toBe('+61412345678');
  });

  it('validates E.164', () => {
    expect(isValidE164('+61412345678')).toBe(true);
    expect(isValidE164('61412345678')).toBe(false);
  });

  it('maps Indian E.164 to checkout mobile', () => {
    expect(e164ToCheckoutMobile('+919876543210')).toBe('9876543210');
  });

  it('parses E.164 dial codes', () => {
    expect(parseE164('+61412345678')).toEqual({ dial: '61', national: '412345678' });
  });
});

describe('verification constants', () => {
  it('uses GB prefix', () => {
    expect(VERIFICATION_CODE_PREFIX).toBe('GB');
  });
});
