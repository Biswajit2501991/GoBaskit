import { getAdminPageStaff } from '@/lib/auth';
import { requireAdminPage } from '@/lib/admin-page';
import FinanceProfitClient from '@/components/Admin/FinanceProfitClient';

export default async function FinanceDeskPage() {
  const staff = await getAdminPageStaff();
  await requireAdminPage(staff, 'finance:view');
  return <FinanceProfitClient />;
}
