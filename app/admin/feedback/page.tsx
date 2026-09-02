import { getAdminPageStaff } from '@/lib/auth';
import { requireAdminPage } from '@/lib/admin-page';
import FeedbackManager from '@/components/Admin/FeedbackManager';

export default async function AdminFeedbackPage() {
  const staff = await getAdminPageStaff();
  await requireAdminPage(staff, 'orders:view');
  return <FeedbackManager />;
}
