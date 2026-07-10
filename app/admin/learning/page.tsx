import { getStaffFromSession } from '@/lib/auth';
import LearningManager from '@/components/Admin/LearningManager';
import { staffHasPermission } from '@/types/staff';
import { requireAdminPage } from '@/lib/admin-page';

export default async function AdminLearningPage() {
  const staff = await getStaffFromSession();
  const { perms } = requireAdminPage(staff, 'learning:view');

  return (
    <LearningManager
      canEdit={staffHasPermission(staff!.role, perms, 'learning:edit')}
    />
  );
}
