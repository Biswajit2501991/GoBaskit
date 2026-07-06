import { getStaffFromSession } from '@/lib/auth';
import { staffHasPermission } from '@/types/staff';
import { requireAdminPage } from '@/lib/admin-page';
import StaffManager from '@/components/Admin/StaffManager';

export const dynamic = 'force-dynamic';

export default async function AdminStaffPage() {
  const staff = await getStaffFromSession();
  requireAdminPage(staff, 'staff:view');
  return <StaffManager />;
}
