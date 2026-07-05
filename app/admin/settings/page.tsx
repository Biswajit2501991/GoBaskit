import { redirect } from 'next/navigation';
import { getStaffFromSession } from '@/lib/auth';
import { SettingsService } from '@/services/SettingsService';
import SettingsManager from '@/components/Admin/SettingsManager';
import { parsePermissions, staffHasPermission } from '@/types/staff';

// Always render fresh so saved settings are reflected on reload (no route caching).
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const staff = await getStaffFromSession();
  if (!staff) redirect('/admin');
  const perms = parsePermissions(staff.permissions);
  if (!staffHasPermission(staff.role, perms, 'settings:view')) {
    redirect('/admin/dashboard');
  }

  const config = await SettingsService.getStoreConfig();
  return (
    <SettingsManager
      initialConfig={config}
      canEdit={staffHasPermission(staff.role, perms, 'settings:edit')}
    />
  );
}
