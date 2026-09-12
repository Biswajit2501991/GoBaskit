import { getAdminPageStaff } from '@/lib/auth';
import { requireAdminPage } from '@/lib/admin-page';
import ShopManager from '@/components/Admin/ShopManager';
import { staffHasPermission } from '@/types/staff';

export const dynamic = 'force-dynamic';

export default async function AdminShopsPage() {
  const staff = await getAdminPageStaff();
  const { perms } = await requireAdminPage(staff, 'settings:view');
  return (
    <ShopManager
      canEdit={staffHasPermission(staff!.role, perms, 'settings:edit')}
      canTagProducts={staffHasPermission(staff!.role, perms, 'products:edit')}
    />
  );
}
