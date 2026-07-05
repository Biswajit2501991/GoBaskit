import { redirect } from 'next/navigation';
import { getStaffFromSession } from '@/lib/auth';
import { parsePermissions, staffHasPermission } from '@/types/staff';
import AnalyticsClient from '@/components/Admin/AnalyticsClient';

export default async function FinanceDeskPage() {
  const staff = await getStaffFromSession();
  if (!staff) redirect('/admin');
  const perms = parsePermissions(staff.permissions);
  if (!staffHasPermission(staff.role, perms, 'finance:view')) {
    redirect('/admin/dashboard');
  }

  return <AnalyticsClient />;
}
