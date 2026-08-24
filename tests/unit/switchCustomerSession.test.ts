import { shouldReleaseCustomerSession } from '@/utils/switchCustomerSession';

describe('shouldReleaseCustomerSession', () => {
  it('releases when this device is already another customer', () => {
    expect(shouldReleaseCustomerSession('9876543210', '9123456789')).toBe(true);
  });

  it('does not release when the same customer continues', () => {
    expect(shouldReleaseCustomerSession('9876543210', '9876543210')).toBe(false);
  });

  it('does not release when no one is signed in yet', () => {
    expect(shouldReleaseCustomerSession('', '9876543210')).toBe(false);
    expect(shouldReleaseCustomerSession(null, '9876543210')).toBe(false);
  });
});
