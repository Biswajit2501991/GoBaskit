import { getStaffFromSession } from '@/lib/auth';
import OrdersManager from '@/components/Admin/OrdersManager';
import { staffHasPermission } from '@/types/staff';
import { requireAdminPage } from '@/lib/admin-page';

export default async function AdminOrdersPage() {
  const staff = await getStaffFromSession();
  const { perms } = requireAdminPage(staff, 'orders:view');

  return (
    <OrdersManager
      currentStaffId={staff!.id}
      canEdit={staffHasPermission(staff!.role, perms, 'orders:edit')}
      canAssign={staffHasPermission(staff!.role, perms, 'orders:assign')}
      canOverrideLock={staffHasPermission(staff!.role, perms, 'orders:override_lock')}
      forceAssignedToMe={staff!.role === 'DELIVERY_MANAGER'}
    />
  );
}
