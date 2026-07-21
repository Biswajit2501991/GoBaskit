import { getStaffFromSession } from '@/lib/auth';
import { requireAdminPage } from '@/lib/admin-page';
import { staffHasPermission } from '@/types/staff';
import BulkPriceAdjustClient from '@/components/Admin/BulkPriceAdjustClient';

export default async function BulkPriceAdjustPage() {
  const staff = await getStaffFromSession();
  const { perms } = requireAdminPage(staff, 'products:edit');
  return (
    <BulkPriceAdjustClient
      canEdit={staffHasPermission(staff!.role, perms, 'products:edit')}
    />
  );
}
