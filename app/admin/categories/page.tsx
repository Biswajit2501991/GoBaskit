import { redirect } from 'next/navigation';
import { getStaffFromSession } from '@/lib/auth';
import CategoryManager from '@/components/Admin/CategoryManager';
import { parsePermissions, staffHasPermission } from '@/types/staff';

export default async function AdminCategoriesPage() {
  const staff = await getStaffFromSession();
  if (!staff) redirect('/admin');
  const perms = parsePermissions(staff.permissions);
  if (!staffHasPermission(staff.role, perms, 'categories:view')) {
    redirect('/admin/dashboard');
  }

  return (
    <CategoryManager
      canEdit={staffHasPermission(staff.role, perms, 'categories:edit')}
    />
  );
}
