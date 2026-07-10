import { openStaffPassword, sealStaffPassword } from '@/lib/staff-password-vault';

describe('staff password vault', () => {
  it('round-trips a password', () => {
    const sealed = sealStaffPassword('secret99');
    expect(sealed.startsWith('v1:')).toBe(true);
    expect(openStaffPassword(sealed)).toBe('secret99');
  });

  it('returns null for missing or corrupt vault', () => {
    expect(openStaffPassword(null)).toBeNull();
    expect(openStaffPassword('not-valid')).toBeNull();
  });
});
