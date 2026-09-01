import { getAdminPageStaff } from '@/lib/auth';
import CategoryManager from '@/components/Admin/CategoryManager';
import { staffHasPermission } from '@/types/staff';
import { requireAdminPage } from '@/lib/admin-page';

export default async function AdminCategoriesPage() {
  const staff = await getAdminPageStaff();
  const { perms } = await requireAdminPage(staff, 'categories:view');

  return (
    <CategoryManager
      canEdit={staffHasPermission(staff!.role, perms, 'categories:edit')}
    />
  );
}
