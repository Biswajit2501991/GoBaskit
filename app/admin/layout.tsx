import { getStaffFromSession } from '@/lib/auth';
import { LogoutButton } from '@/components/Admin/LogoutButton';
import { NotificationCenter } from '@/components/Admin/NotificationCenter';
import { AdminNavLink } from '@/components/Admin/AdminNavLink';
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
  const perms = staff ? parsePermissions(staff.permissions) : [];

  const visibleNav = staff
    ? nav.filter((item) => staffHasPermission(staff.role, perms, item.permission))
    : [];

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {staff && (
        <aside className="w-56 shrink-0 h-screen bg-white border-r border-gray-200 p-4 flex flex-col sticky top-0">
          <div className="mb-8">
            <span className="font-extrabold text-lg">Go<span className="text-blinkit-green">Baskit</span></span>
            <p className="text-xs text-gray-400 mt-1">Staff Portal</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{staff.name} · {staff.role.replace(/_/g, ' ')}</p>
          </div>
          <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
            {visibleNav.map((item) => (
              <AdminNavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
          <div className="pt-3 mt-3 border-t border-gray-100">
            <LogoutButton />
          </div>
        </aside>
      )}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto flex flex-col">
        {staff && (
          <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-end sticky top-0 z-10">
            <NotificationCenter />
          </header>
        )}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
