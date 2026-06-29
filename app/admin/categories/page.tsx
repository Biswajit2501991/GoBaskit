import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import CategoryManager from '@/components/Admin/CategoryManager';

export default async function AdminCategoriesPage() {
  if (!(await getAdminSession())) redirect('/admin');

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  return <CategoryManager categories={categories} />;
}
