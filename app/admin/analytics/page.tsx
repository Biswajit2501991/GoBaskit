import { getAdminPageStaff } from '@/lib/auth';
import { staffHasPermission } from '@/types/staff';
import { requireAdminPage } from '@/lib/admin-page';
import AnalyticsClient from '@/components/Admin/AnalyticsClient';

export default async function AdminAnalyticsPage() {
  const staff = await getAdminPageStaff();
  requireAdminPage(staff, 'analytics:view');
  return <AnalyticsClient />;
}
