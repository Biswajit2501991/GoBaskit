import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';
import { staffHasPermission, parsePermissions } from '@/types/staff';

describe('normalizeMobile', () => {
  it('strips country code and non-digits', () => {
    expect(normalizeMobile('+91 90463 70119')).toBe('9046370119');
    expect(normalizeMobile('919046370119')).toBe('9046370119');
  });

  it('keeps 10-digit numbers', () => {
    expect(normalizeMobile('9046370119')).toBe('9046370119');
  });
});

describe('isValidIndianMobile', () => {
  it('accepts valid Indian mobiles', () => {
    expect(isValidIndianMobile('9046370119')).toBe(true);
    expect(isValidIndianMobile('7000000000')).toBe(true);
  });

  it('rejects invalid mobiles', () => {
    expect(isValidIndianMobile('123')).toBe(false);
    expect(isValidIndianMobile('5046370119')).toBe(false);
  });
});

describe('staffHasPermission', () => {
  it('grants all permissions to SUPER_ADMIN', () => {
    expect(staffHasPermission('SUPER_ADMIN', [], 'staff:manage')).toBe(true);
    expect(staffHasPermission('SUPER_ADMIN', [], 'orders:delete')).toBe(true);
  });

  it('enforces role defaults for INVENTORY_MANAGER', () => {
    expect(staffHasPermission('INVENTORY_MANAGER', [], 'products:edit')).toBe(true);
    expect(staffHasPermission('INVENTORY_MANAGER', [], 'orders:delete')).toBe(false);
  });

  it('honors custom permissions on CUSTOM role', () => {
    const perms = parsePermissions(['orders:view']);
    expect(staffHasPermission('CUSTOM', perms, 'orders:view')).toBe(true);
    expect(staffHasPermission('CUSTOM', perms, 'orders:delete')).toBe(false);
  });
});
