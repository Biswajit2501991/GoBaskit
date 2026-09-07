import { ADMIN_NAV_ITEMS, adminNavForPath, groupAdminNav } from '@/lib/adminNav';

describe('admin nav grouping', () => {
  const publicItems = ADMIN_NAV_ITEMS.map(({ href, label, group, hint }) => ({
    href,
    label,
    group,
    hint,
  }));

  it('keeps every destination when grouping', () => {
    const grouped = groupAdminNav(publicItems);
    const hrefs = grouped.flatMap((g) => g.items.map((i) => i.href)).sort();
    expect(hrefs).toEqual([...publicItems.map((i) => i.href)].sort());
  });

  it('picks the longest matching path for the page hint', () => {
    expect(adminNavForPath('/admin/orders', publicItems)?.label).toBe('Orders');
    expect(adminNavForPath('/admin/settings', publicItems)?.label).toBe('Settings');
    expect(adminNavForPath('/admin', publicItems)).toBeNull();
  });
});
