import type { Metadata } from 'next';
import { getAdminPageStaff } from '@/lib/auth';
import { AdminShell } from '@/components/Admin/AdminShell';
import { parsePermissions, staffHasPermission } from '@/types/staff';
import { ADMIN_NAV_ITEMS } from '@/lib/adminNav';

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

const nav = ADMIN_NAV_ITEMS;

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
        visibleNav={visibleNav.map((item) => ({
          href: item.href,
          label: item.label,
          group: item.group,
          hint: item.hint,
        }))}
      >
        {children}
      </AdminShell>
    </>
  );
}
