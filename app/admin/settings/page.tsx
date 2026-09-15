import { getAdminPageStaff } from '@/lib/auth';
import { SettingsService } from '@/services/SettingsService';
import SettingsManager from '@/components/Admin/SettingsManager';
import { requireAdminPage } from '@/lib/admin-page';
import { SETTINGS_NAV_SECTIONS } from '@/lib/settingsNav';
import { canAccessSettingsSection, staffHasEffectivePermission } from '@/lib/staffAccess';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const staff = await getAdminPageStaff();
  await requireAdminPage(staff, 'settings:view');

  const config = await SettingsService.getStoreConfig();
  const allowedSectionIds = SETTINGS_NAV_SECTIONS
    .filter((section) => canAccessSettingsSection(staff!, section.id))
    .map((section) => section.id);
  return (
    <SettingsManager
      initialConfig={config}
      canEdit={staffHasEffectivePermission(staff!, 'settings:edit')}
      allowedSectionIds={allowedSectionIds}
    />
  );
}
