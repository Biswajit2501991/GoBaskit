import { redirect } from 'next/navigation';
import { getAdminPageStaff } from '@/lib/auth';
import { adminLoginRedirectHref } from '@/lib/admin-page';
import { staffHasEffectivePermission, staffPortalHomePath, canAccessAdminPath } from '@/lib/staffAccess';
import DashboardClient from '@/components/Admin/DashboardClient';

export default async function AdminDashboard() {
  const staff = await getAdminPageStaff();
  if (!staff) redirect(await adminLoginRedirectHref());

  if (!canAccessAdminPath(staff, '/admin/dashboard') || !staffHasEffectivePermission(staff, 'analytics:view')) {
    redirect(staffPortalHomePath(staff));
  }

  return <DashboardClient />;
}
