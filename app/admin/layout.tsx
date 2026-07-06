import { getStaffFromSession } from '@/lib/auth';
import { AdminShell } from '@/components/Admin/AdminShell';
import { parsePermissions, staffHasPermission, type Permission } from '@/types/staff';

const nav: { href: string; label: string; permission: Permission }[] = [
  { href: '/admin/dashboard', label: 'Dashboard', permission: 'analytics:view' },
  { href: '/admin/analytics', label: 'Analytics', permission: 'analytics:view' },
  { href: '/admin/delivery', label: 'Delivery Desk', permission: 'delivery:view' },
  { href: '/admin/inventory', label: 'Inventory Desk', permission: 'products:view' },
  { href: '/admin/finance', label: 'Finance Desk', permission: 'finance:view' },
  { href: '/admin/products', label: 'Products', permission: 'products:view' },
  { href: '/admin/categories', label: 'Categories', permission: 'categories:view' },
  { href: '/admin/orders', label: 'Orders', permission: 'orders:view' },
  { href: '/admin/bulk-upload', label: 'Bulk Upload', permission: 'bulk_upload:use' },
  { href: '/admin/staff', label: 'Staff', permission: 'staff:view' },
  { href: '/admin/settings', label: 'Settings', permission: 'settings:view' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaffFromSession();
  if (!staff) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }
  const perms = staff ? parsePermissions(staff.permissions) : [];

  const visibleNav = staff
    ? nav.filter((item) => staffHasPermission(staff.role, perms, item.permission))
    : [];

  return (
    <AdminShell
      staff={{ id: staff.id, name: staff.name, role: staff.role }}
      visibleNav={visibleNav.map((item) => ({ href: item.href, label: item.label }))}
    >
      {children}
    </AdminShell>
  );
}
