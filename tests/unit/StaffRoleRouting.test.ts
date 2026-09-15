import { getRoleDefaultAdminPath, staffHomePath } from '@/types/staff';

describe('getRoleDefaultAdminPath', () => {
  it('routes delivery roles to assigned orders view', () => {
    expect(getRoleDefaultAdminPath('DELIVERY_MANAGER')).toBe('/admin/delivery');
    expect(getRoleDefaultAdminPath('DELIVERY_PARTNER')).toBe('/delivery');
  });

  it('sends shopkeepers and partners to their portals', () => {
    expect(staffHomePath({ role: 'DELIVERY_PARTNER', shopId: null })).toBe('/delivery');
    expect(staffHomePath({ role: 'DELIVERY_PARTNER', shopId: 'shop1' })).toBe('/shop');
    expect(staffHomePath({ role: 'ORDER_MANAGER' })).toBe('/admin/orders');
  });

  it('routes inventory and finance roles to focused pages', () => {
    expect(getRoleDefaultAdminPath('INVENTORY_MANAGER')).toBe('/admin/inventory');
    expect(getRoleDefaultAdminPath('FINANCE')).toBe('/admin/finance');
  });

  it('keeps super admin on dashboard', () => {
    expect(getRoleDefaultAdminPath('SUPER_ADMIN')).toBe('/admin/dashboard');
  });
});
