import { getAdminPageStaff } from '@/lib/auth';
import ArchiveManager from '@/components/Admin/ArchiveManager';
import { requireAdminPage } from '@/lib/admin-page';

export default async function AdminArchivePage() {
  const staff = await getAdminPageStaff();
  requireAdminPage(staff, 'orders:view');

  return <ArchiveManager />;
}
