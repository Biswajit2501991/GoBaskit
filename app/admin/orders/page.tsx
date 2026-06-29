import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDateTime } from '@/utils/formatter';

export default async function AdminOrdersPage() {
  if (!(await getAdminSession())) redirect('/admin');

  const orders = await prisma.order.findMany({
    include: { customer: true, items: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Orders ({orders.length})</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold">{order.orderNumber}</p>
                <p className="text-sm text-gray-500">{order.customer.firstName} {order.customer.lastName} · +91 {order.customer.mobile}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDateTime(order.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-blinkit-green">{formatCurrency(order.grandTotal)}</p>
                <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">{order.status}</span>
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              {order.items.map((item) => (
                <p key={item.id}>{item.productName} × {item.quantity} = {formatCurrency(item.totalPrice)}</p>
              ))}
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-gray-500">No orders yet</p>}
      </div>
    </div>
  );
}
