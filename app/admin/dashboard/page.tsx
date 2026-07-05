import { redirect } from 'next/navigation';
import { getStaffFromSession } from '@/lib/auth';
import { parsePermissions, staffHasPermission } from '@/types/staff';
import DashboardClient from '@/components/Admin/DashboardClient';

export default async function AdminDashboard() {
  const staff = await getStaffFromSession();
  if (!staff) redirect('/admin');
  const perms = parsePermissions(staff.permissions);
  if (!staffHasPermission(staff.role, perms, 'analytics:view')) {
    redirect('/admin/orders');
  }
  return <DashboardClient />;
}
