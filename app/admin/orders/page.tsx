import { redirect } from 'next/navigation';
import { getStaffFromSession } from '@/lib/auth';
import OrdersManager from '@/components/Admin/OrdersManager';
import { parsePermissions, staffHasPermission } from '@/types/staff';

export default async function AdminOrdersPage() {
  const staff = await getStaffFromSession();
  if (!staff) redirect('/admin');

  const perms = parsePermissions(staff.permissions);
  if (!staffHasPermission(staff.role, perms, 'orders:view')) {
    redirect('/admin/dashboard');
  }

  return (
    <OrdersManager
      currentStaffId={staff.id}
      canEdit={staffHasPermission(staff.role, perms, 'orders:edit')}
      canAssign={staffHasPermission(staff.role, perms, 'orders:assign')}
      canOverrideLock={staffHasPermission(staff.role, perms, 'orders:override_lock')}
    />
  );
}
