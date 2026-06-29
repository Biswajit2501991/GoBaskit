import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ProductManager from '@/components/Admin/ProductManager';

export default async function AdminProductsPage() {
  if (!(await getAdminSession())) redirect('/admin');

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
  ]);

  return <ProductManager products={products} categories={categories} />;
}
