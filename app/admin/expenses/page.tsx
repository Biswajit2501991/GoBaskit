import { getAdminPageStaff } from '@/lib/auth';
import { requireAdminPage } from '@/lib/admin-page';
import ExpensesClient from '@/components/Admin/ExpensesClient';
import { staffHasPermission } from '@/types/staff';

export default async function ExpensesPage() {
  const staff = await getAdminPageStaff();
  const { perms } = await requireAdminPage(staff, 'finance:view');
  return (
    <ExpensesClient
      canEdit={staffHasPermission(staff!.role, perms, 'finance:edit')}
      canToggle={staffHasPermission(staff!.role, perms, 'settings:edit')}
    />
  );
}
