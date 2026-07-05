import { redirect } from 'next/navigation';
import { getStaffFromSession } from '@/lib/auth';
import { getRoleDefaultAdminPath, parsePermissions, staffHasPermission } from '@/types/staff';
import DashboardClient from '@/components/Admin/DashboardClient';

export default async function AdminDashboard() {
  const staff = await getStaffFromSession();
  if (!staff) redirect('/admin');
  const perms = parsePermissions(staff.permissions);
  const roleHome = getRoleDefaultAdminPath(staff.role);
  if (roleHome !== '/admin/dashboard') {
    redirect(roleHome);
  }
  if (!staffHasPermission(staff.role, perms, 'analytics:view')) {
    redirect('/admin/orders');
  }
  return <DashboardClient />;
}
