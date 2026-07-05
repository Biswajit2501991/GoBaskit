'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@/utils/formatter';

interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  processingOrders: number;
  outForDeliveryOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  monthlyRevenue: number;
  totalOrders: number;
  totalRevenue: number;
  customerCount: number;
  productCount: number;
  categoryCount: number;
  lowStockCount: number;
  staffOnline: number;
  unreadNotifications: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  dailyTrend: Array<{ day: string; orders: number; revenue: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    grandTotal: number;
    status: string;
    createdAt: string;
    customerName: string;
  }>;
}

const cardClass = 'bg-white rounded-xl border border-gray-100 p-4';

export default function DashboardClient() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await fetch('/api/admin/dashboard/stats');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as DashboardStats;
      if (alive) {
        setStats(data);
        setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const trendMax = useMemo(() => {
    if (!stats?.dailyTrend?.length) return 1;
    return Math.max(...stats.dailyTrend.map((d) => d.revenue), 1);
  }, [stats]);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading dashboard...</div>;
  }
  if (!stats) {
    return <div className="p-6 text-red-500">Unable to load dashboard data.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cardClass}><p className="text-xs text-gray-500">Today's Orders</p><p className="text-2xl font-bold mt-1">{stats.todayOrders}</p></div>
        <div className={cardClass}><p className="text-xs text-gray-500">Pending</p><p className="text-2xl font-bold mt-1">{stats.pendingOrders}</p></div>
        <div className={cardClass}><p className="text-xs text-gray-500">Processing</p><p className="text-2xl font-bold mt-1">{stats.processingOrders}</p></div>
        <div className={cardClass}><p className="text-xs text-gray-500">Out For Delivery</p><p className="text-2xl font-bold mt-1">{stats.outForDeliveryOrders}</p></div>
        <div className={cardClass}><p className="text-xs text-gray-500">Delivered</p><p className="text-2xl font-bold mt-1">{stats.deliveredOrders}</p></div>
        <div className={cardClass}><p className="text-xs text-gray-500">Cancelled</p><p className="text-2xl font-bold mt-1">{stats.cancelledOrders}</p></div>
        <div className={cardClass}><p className="text-xs text-gray-500">Today's Revenue</p><p className="text-2xl font-bold mt-1">{formatCurrency(stats.todayRevenue)}</p></div>
        <div className={cardClass}><p className="text-xs text-gray-500">Monthly Revenue</p><p className="text-2xl font-bold mt-1">{formatCurrency(stats.monthlyRevenue)}</p></div>
        <div className={cardClass}><p className="text-xs text-gray-500">Customers</p><p className="text-2xl font-bold mt-1">{stats.customerCount}</p></div>
        <div className={cardClass}><p className="text-xs text-gray-500">Products</p><p className="text-2xl font-bold mt-1">{stats.productCount}</p></div>
        <div className={cardClass}><p className="text-xs text-gray-500">Low Stock</p><p className="text-2xl font-bold mt-1">{stats.lowStockCount}</p></div>
        <div className={cardClass}><p className="text-xs text-gray-500">Unread Notifications</p><p className="text-2xl font-bold mt-1">{stats.unreadNotifications}</p></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className={cardClass}>
          <h2 className="font-semibold mb-3">Revenue Trend (7 days)</h2>
          <div className="space-y-2">
            {stats.dailyTrend.map((row) => (
              <div key={row.day} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-24">{row.day.slice(5)}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded">
                  <div className="h-2 bg-blinkit-green rounded" style={{ width: `${Math.max(4, (row.revenue / trendMax) * 100)}%` }} />
                </div>
                <span className="text-xs font-medium w-24 text-right">{formatCurrency(row.revenue)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="font-semibold mb-3">Top Products</h2>
          <div className="space-y-2">
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-gray-500">No sales data yet.</p>
            ) : stats.topProducts.map((row) => (
              <div key={row.name} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                <span>{row.name}</span>
                <span className="text-gray-600">{row.quantity} sold · {formatCurrency(row.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <h2 className="font-semibold mb-3">Recent Activity</h2>
        <div className="space-y-2 text-sm">
          {stats.recentOrders.map((order) => (
            <div key={order.id} className="flex justify-between border-b border-gray-50 pb-2">
              <span>{order.orderNumber} · {order.customerName}</span>
              <span className="text-gray-600">{order.status} · {formatCurrency(order.grandTotal)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
