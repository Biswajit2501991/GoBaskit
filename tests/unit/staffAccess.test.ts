import {
  canAccessAdminPath,
  defaultSectionIdsForRole,
  pageAccessId,
  parseAccessGrants,
  resolveStaffAccess,
  staffHasEffectivePermission,
  visibleAdminNav,
  staffPortalHomePath,
} from '@/lib/staffAccess';
import { settingsSectionAccessId } from '@/lib/settingsNav';

describe('staff access grants', () => {
  it('keeps role defaults when grants are null so existing staff do not lose pages', () => {
    const access = resolveStaffAccess({ role: 'ORDER_MANAGER', accessGrants: null });
    expect(access.allowlist).toBe(false);
    expect(access.hrefs.has('/admin/orders')).toBe(true);
    expect(access.hrefs.has('/admin/archive')).toBe(true);
    expect(access.hrefs.has('/admin/products')).toBe(true);
    expect(access.hrefs.has('/admin/staff')).toBe(false);
    expect(visibleAdminNav({ role: 'ORDER_MANAGER' }).some((item) => item.href === '/admin/orders')).toBe(true);
  });

  it('hides unticked pages and blocks their URLs when All Super Admin saves ticks', () => {
    const grants = { sections: [pageAccessId('/admin/orders'), pageAccessId('/admin/delivery')] };
    const staff = { role: 'ORDER_MANAGER' as const, accessGrants: grants };
    expect(visibleAdminNav(staff).map((item) => item.href)).toEqual(['/admin/orders', '/admin/delivery']);
    expect(canAccessAdminPath(staff, '/admin/archive')).toBe(false);
    expect(canAccessAdminPath(staff, '/admin/orders')).toBe(true);
    expect(staffHasEffectivePermission(staff, 'orders:view')).toBe(true);
    expect(staffHasEffectivePermission(staff, 'orders:edit')).toBe(false);
    expect(staffPortalHomePath(staff)).toBe('/admin/orders');
  });

  it('ignores unknown grant ids', () => {
    expect(parseAccessGrants({ sections: [pageAccessId('/admin/orders'), 'nope'] })?.sections).toEqual([
      pageAccessId('/admin/orders'),
    ]);
  });

  it('starts ticks from the named role defaults', () => {
    expect(defaultSectionIdsForRole('INVENTORY_MANAGER').includes(pageAccessId('/admin/inventory'))).toBe(true);
    expect(defaultSectionIdsForRole('INVENTORY_MANAGER').includes(pageAccessId('/admin/orders'))).toBe(false);
    expect(defaultSectionIdsForRole('INVENTORY_MANAGER').includes(settingsSectionAccessId('pins'))).toBe(false);
  });
});
