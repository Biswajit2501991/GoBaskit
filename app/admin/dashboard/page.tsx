import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/utils/formatter';

export default async function AdminDashboard() {
  const session = await getAdminSession();
  if (!session) redirect('/admin');

  const [productCount, orderCount, categoryCount, recentOrders, revenue] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.category.count(),
    prisma.order.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { customer: true } }),
    prisma.order.aggregate({ _sum: { grandTotal: true } }),
  ]);

  const stats = [
    { label: 'Products', value: productCount, href: '/admin/products' },
    { label: 'Categories', value: categoryCount, href: '/admin/categories' },
    { label: 'Orders', value: orderCount, href: '/admin/orders' },
    { label: 'Revenue', value: formatCurrency(revenue._sum.grandTotal || 0), href: '/admin/orders' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-bold mb-4">Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-500 text-sm">No orders yet</p>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-3">
                <div>
                  <p className="font-semibold">{order.orderNumber}</p>
                  <p className="text-gray-500">{order.customer.firstName} {order.customer.lastName}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blinkit-green">{formatCurrency(order.grandTotal)}</p>
                  <p className="text-xs text-gray-400">{order.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
