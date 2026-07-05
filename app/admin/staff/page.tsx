import { redirect } from 'next/navigation';
import { getStaffFromSession } from '@/lib/auth';
import { staffHasPermission } from '@/types/staff';
import { parsePermissions } from '@/types/staff';
import StaffManager from '@/components/Admin/StaffManager';

export const dynamic = 'force-dynamic';

export default async function AdminStaffPage() {
  const staff = await getStaffFromSession();
  if (!staff) redirect('/admin');

  const perms = parsePermissions(staff.permissions);
  if (!staffHasPermission(staff.role, perms, 'staff:view')) {
    redirect('/admin/dashboard');
  }

  return <StaffManager />;
}
