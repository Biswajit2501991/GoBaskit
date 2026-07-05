import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import { SettingsService } from '@/services/SettingsService';
import SettingsManager from '@/components/Admin/SettingsManager';

export default async function AdminSettingsPage() {
  if (!(await getAdminSession())) redirect('/admin');

  const config = await SettingsService.getStoreConfig();

  return <SettingsManager initialConfig={config} />;
}
