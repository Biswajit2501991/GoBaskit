import { getStaffFromSession } from '@/lib/auth';
import { staffHasPermission } from '@/types/staff';
import { requireAdminPage } from '@/lib/admin-page';
import OrdersManager from '@/components/Admin/OrdersManager';

export default async function DeliveryDeskPage() {
  const staff = await getStaffFromSession();
  const { perms } = requireAdminPage(staff, 'delivery:view');

  return (
    <OrdersManager
      currentStaffId={staff!.id}
      canEdit={staffHasPermission(staff!.role, perms, 'delivery:update')}
      canAssign={false}
      canOverrideLock={staffHasPermission(staff!.role, perms, 'orders:override_lock')}
      forceAssignedToMe
    />
  );
}
