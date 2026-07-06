import { getStaffFromSession } from '@/lib/auth';
import CategoryManager from '@/components/Admin/CategoryManager';
import { staffHasPermission } from '@/types/staff';
import { requireAdminPage } from '@/lib/admin-page';

export default async function AdminCategoriesPage() {
  const staff = await getStaffFromSession();
  const { perms } = requireAdminPage(staff, 'categories:view');

  return (
    <CategoryManager
      canEdit={staffHasPermission(staff!.role, perms, 'categories:edit')}
    />
  );
}
