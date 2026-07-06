import { getStaffFromSession } from '@/lib/auth';
import { requireAdminPage } from '@/lib/admin-page';
import { parsePermissions, staffHasPermission } from '@/types/staff';
import WhatsAppVerificationManager from '@/components/Admin/WhatsAppVerificationManager';

export default async function WhatsAppVerificationPage() {
  const staff = await getStaffFromSession();
  requireAdminPage(staff, 'verification:view');
  const perms = parsePermissions(staff!.permissions);
  const canManage = staffHasPermission(staff!.role, perms, 'verification:manage');

  return <WhatsAppVerificationManager canManage={canManage} />;
}
