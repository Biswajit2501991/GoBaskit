import { getAdminPageStaff } from '@/lib/auth';
import { requireAdminPage } from '@/lib/admin-page';
import StaffManager from '@/components/Admin/StaffManager';
import { staffHasEffectivePermission } from '@/lib/staffAccess';

export const dynamic = 'force-dynamic';

export default async function AdminStaffPage() {
  const staff = await getAdminPageStaff();
  await requireAdminPage(staff, 'staff:view');
  const canManage = staffHasEffectivePermission(staff!, 'staff:manage');
  return <StaffManager canManage={canManage} actorRole={staff!.role} />;
}
