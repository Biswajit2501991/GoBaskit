import { getStaffFromSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ProductManager from '@/components/Admin/ProductManager';
import { staffHasPermission } from '@/types/staff';
import { requireAdminPage } from '@/lib/admin-page';

export default async function InventoryDeskPage() {
  const staff = await getStaffFromSession();
  const { perms } = requireAdminPage(staff, 'products:view');

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return (
    <ProductManager
      categories={categories}
      canEdit={staffHasPermission(staff!.role, perms, 'products:edit')}
      canDelete={staffHasPermission(staff!.role, perms, 'products:delete')}
      sort="stock"
      title="Inventory"
      subtitle="sorted by stock level"
    />
  );
}
