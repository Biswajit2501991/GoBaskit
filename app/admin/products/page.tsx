import { getStaffFromSession } from '@/lib/auth';
import ProductManager from '@/components/Admin/ProductManager';
import { staffHasPermission } from '@/types/staff';
import { requireAdminPage } from '@/lib/admin-page';

export default async function AdminProductsPage() {
  const staff = await getStaffFromSession();
  const { perms } = requireAdminPage(staff, 'products:view');

  return (
    <ProductManager
      canEdit={staffHasPermission(staff!.role, perms, 'products:edit')}
      canDelete={staffHasPermission(staff!.role, perms, 'products:delete')}
    />
  );
}
