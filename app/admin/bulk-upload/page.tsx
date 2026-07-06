import { getStaffFromSession } from '@/lib/auth';
import { requireAdminPage } from '@/lib/admin-page';
import BulkUploadPageClient from '@/components/Admin/BulkUploadPageClient';

export default async function BulkUploadPage() {
  const staff = await getStaffFromSession();
  requireAdminPage(staff, 'bulk_upload:use');
  return <BulkUploadPageClient />;
}
