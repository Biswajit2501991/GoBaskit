import { redirect } from 'next/navigation';
import { getStaffFromSession } from '@/lib/auth';
import OrdersManager from '@/components/Admin/OrdersManager';
import { parsePermissions, staffHasPermission } from '@/types/staff';

export default async function DeliveryDeskPage() {
  const staff = await getStaffFromSession();
  if (!staff) redirect('/admin');
  const perms = parsePermissions(staff.permissions);
  if (!staffHasPermission(staff.role, perms, 'delivery:view')) {
    redirect('/admin/dashboard');
  }

  return (
    <OrdersManager
      currentStaffId={staff.id}
      canEdit={staffHasPermission(staff.role, perms, 'delivery:update')}
      canAssign={false}
      canOverrideLock={staffHasPermission(staff.role, perms, 'orders:override_lock')}
      forceAssignedToMe
    />
  );
}
