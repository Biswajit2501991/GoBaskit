import { getStaffFromSession } from '@/lib/auth';
import { requireAdminPage } from '@/lib/admin-page';
import AnalyticsClient from '@/components/Admin/AnalyticsClient';

export default async function FinanceDeskPage() {
  const staff = await getStaffFromSession();
  requireAdminPage(staff, 'finance:view');
  return <AnalyticsClient />;
}
