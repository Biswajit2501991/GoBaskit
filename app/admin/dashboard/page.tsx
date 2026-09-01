import { redirect } from 'next/navigation';
import { getAdminPageStaff } from '@/lib/auth';
import { adminLoginRedirectHref } from '@/lib/admin-page';
import { getRoleDefaultAdminPath, parsePermissions, staffHasPermission } from '@/types/staff';
import DashboardClient from '@/components/Admin/DashboardClient';

export default async function AdminDashboard() {
  const staff = await getAdminPageStaff();
  if (!staff) redirect(await adminLoginRedirectHref());

  const perms = parsePermissions(staff.permissions);
  const roleHome = getRoleDefaultAdminPath(staff.role);
  if (roleHome !== '/admin/dashboard') {
    redirect(roleHome);
  }
  if (!staffHasPermission(staff.role, perms, 'analytics:view')) {
    redirect(roleHome);
  }

  return <DashboardClient />;
}
