import { getAdminPageStaff } from '@/lib/auth';
import { requireAdminPage } from '@/lib/admin-page';
import WishlistDemandManager from '@/components/Admin/WishlistDemandManager';

export default async function AdminWishlistDemandPage() {
  const staff = await getAdminPageStaff();
  await requireAdminPage(staff, 'products:view');
  return <WishlistDemandManager />;
}
