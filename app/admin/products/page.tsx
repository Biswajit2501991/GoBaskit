import { redirect } from 'next/navigation';
import { getStaffFromSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ProductManager from '@/components/Admin/ProductManager';
import { parsePermissions, staffHasPermission } from '@/types/staff';

export default async function AdminProductsPage() {
  const staff = await getStaffFromSession();
  if (!staff) redirect('/admin');
  const perms = parsePermissions(staff.permissions);
  if (!staffHasPermission(staff.role, perms, 'products:view')) {
    redirect('/admin/dashboard');
  }

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return (
    <ProductManager
      categories={categories}
      canEdit={staffHasPermission(staff.role, perms, 'products:edit')}
      canDelete={staffHasPermission(staff.role, perms, 'products:delete')}
    />
  );
}
