import { getStaffFromSession } from '@/lib/auth';
import { SettingsService } from '@/services/SettingsService';
import SettingsManager from '@/components/Admin/SettingsManager';
import { staffHasPermission } from '@/types/staff';
import { requireAdminPage } from '@/lib/admin-page';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const staff = await getStaffFromSession();
  const { perms } = requireAdminPage(staff, 'settings:view');

  const config = await SettingsService.getStoreConfig();
  return (
    <SettingsManager
      initialConfig={config}
      canEdit={staffHasPermission(staff!.role, perms, 'settings:edit')}
    />
  );
}
