import type { Metadata } from 'next';
import { getAdminPageStaff } from '@/lib/auth';
import { AdminShell } from '@/components/Admin/AdminShell';
import { parsePermissions, staffHasPermission, type Permission } from '@/types/staff';

export const metadata: Metadata = {
  // Keep staff "Add to Home Screen" opening Orders for push alerts,
  // while sharing the same GoBaskit brand icons as the storefront.
  manifest: '/admin-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'GoBaskit Admin',
    statusBarStyle: 'default',
  },
};

const nav: { href: string; label: string; permission: Permission }[] = [
  { href: '/admin/dashboard', label: 'Dashboard', permission: 'analytics:view' },
  { href: '/admin/analytics', label: 'Analytics', permission: 'analytics:view' },
  { href: '/admin/delivery', label: 'Delivery Desk', permission: 'delivery:view' },
  { href: '/admin/inventory', label: 'Inventory Desk', permission: 'products:view' },
  { href: '/admin/finance', label: 'Finance Desk', permission: 'finance:view' },
  { href: '/admin/products', label: 'Products', permission: 'products:view' },
  { href: '/admin/price-adjust', label: 'Price Adjust', permission: 'products:edit' },
  { href: '/admin/categories', label: 'Categories', permission: 'categories:view' },
  { href: '/admin/orders', label: 'Orders', permission: 'orders:view' },
  { href: '/admin/whatsapp-verification', label: 'WhatsApp Verification', permission: 'verification:view' },
  { href: '/admin/bulk-upload', label: 'Bulk Upload', permission: 'bulk_upload:use' },
  { href: '/admin/staff', label: 'Staff', permission: 'staff:view' },
  { href: '/admin/settings', label: 'Settings', permission: 'settings:view' },
  { href: '/admin/learning', label: 'Learning', permission: 'learning:view' },
  { href: '/admin/archive', label: 'Archive', permission: 'orders:view' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let staff: Awaited<ReturnType<typeof getAdminPageStaff>> = null;
  try {
    staff = await getAdminPageStaff();
  } catch (err) {
    // Let Next.js dynamic rendering proceed; only swallow unexpected failures.
    const digest = err && typeof err === 'object' && 'digest' in err ? String((err as { digest?: string }).digest) : '';
    if (digest === 'DYNAMIC_SERVER_USAGE') throw err;
    console.error('[admin/layout] session lookup failed', err);
  }
  if (!staff) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }
  const perms = parsePermissions(staff.permissions);

  const visibleNav = nav.filter((item) => staffHasPermission(staff!.role, perms, item.permission));

  return (
    <>
      {/* Avoid light flash before AdminThemeToggle hydrates. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var p=localStorage.getItem('gobaskit_admin_color_mode')||'system';var dark=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.adminTheme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';}catch(e){}})();`,
        }}
      />
      <AdminShell
        staff={{ id: staff.id, name: staff.name, role: staff.role }}
        visibleNav={visibleNav.map((item) => ({ href: item.href, label: item.label }))}
      >
        {children}
      </AdminShell>
    </>
  );
}
