import { getAdminPageStaff } from '@/lib/auth';
import { parsePermissions, staffHasPermission } from '@/types/staff';
import { requireAdminPage } from '@/lib/admin-page';
import StaffManager from '@/components/Admin/StaffManager';

export const dynamic = 'force-dynamic';

export default async function AdminStaffPage() {
  const staff = await getAdminPageStaff();
  await requireAdminPage(staff, 'staff:view');
  const perms = parsePermissions(staff!.permissions);
  const canManage = staffHasPermission(staff!.role, perms, 'staff:manage');
  return <StaffManager canManage={canManage} actorRole={staff!.role} />;
}
