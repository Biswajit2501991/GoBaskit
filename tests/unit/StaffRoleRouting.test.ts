import { getRoleDefaultAdminPath } from '@/types/staff';

describe('getRoleDefaultAdminPath', () => {
  it('routes delivery roles to assigned orders view', () => {
    expect(getRoleDefaultAdminPath('DELIVERY_MANAGER')).toBe('/admin/delivery');
  });

  it('routes inventory and finance roles to focused pages', () => {
    expect(getRoleDefaultAdminPath('INVENTORY_MANAGER')).toBe('/admin/inventory');
    expect(getRoleDefaultAdminPath('FINANCE')).toBe('/admin/finance');
  });

  it('keeps super admin on dashboard', () => {
    expect(getRoleDefaultAdminPath('SUPER_ADMIN')).toBe('/admin/dashboard');
  });
});
