import { getAdminPageStaff } from '@/lib/auth';
import { requireAdminPage } from '@/lib/admin-page';
import ProfitDashboardClient from '@/components/Admin/ProfitDashboardClient';
import { staffHasPermission } from '@/types/staff';

export default async function ProfitDashboardPage() {
  const staff = await getAdminPageStaff();
  const { perms } = await requireAdminPage(staff, 'finance:view');
  return (
    <ProfitDashboardClient
      canToggle={staffHasPermission(staff!.role, perms, 'settings:edit')}
    />
  );
}
