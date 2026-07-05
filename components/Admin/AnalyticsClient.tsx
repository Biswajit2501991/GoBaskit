'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/utils/formatter';

interface AnalyticsOverview {
  salesLast30Days: number;
  ordersLast30Days: number;
  averageBasketValue: number;
  customersLast30Days: number;
  averageDeliveryMinutes: number;
  statusBreakdown: Array<{ status: string; count: number }>;
  conversionRate: number;
  abandonmentRate: number;
  abandonedOrdersProxy: number;
  checkoutAttemptsProxy: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  lowProducts: Array<{ name: string; quantity: number; revenue: number }>;
  staffPerformance: Array<{
    staffId: string;
    staffName: string;
    assignedOrders: number;
    deliveredOrders: number;
    completionRate: number;
    averageHandleMinutes: number;
  }>;
  salesTrend: Array<{ day: string; revenue: number; orders: number }>;
  updatedAt: string;
}

export default function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    fetch('/api/admin/analytics')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (live) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Loading analytics...</div>;
  if (!data) return <div className="p-6 text-red-500">Analytics unavailable.</div>;

  const maxRevenue = Math.max(...data.salesTrend.map((d) => d.revenue), 1);
  const cards = [
    { label: 'Sales (30d)', value: formatCurrency(data.salesLast30Days) },
    { label: 'Orders (30d)', value: data.ordersLast30Days.toString() },
    { label: 'Avg Basket', value: formatCurrency(data.averageBasketValue) },
    { label: 'Customers (30d)', value: data.customersLast30Days.toString() },
    { label: 'Avg Delivery (mins)', value: data.averageDeliveryMinutes.toString() },
    { label: 'Conversion Rate', value: `${data.conversionRate}%` },
    { label: 'Abandonment (proxy)', value: `${data.abandonmentRate}%` },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-lg font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-semibold mb-3">Revenue Trend (30 days)</h2>
          <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {data.salesTrend.map((row) => (
              <div key={row.day} className="flex items-center gap-2 text-xs">
                <span className="w-12 text-gray-500">{row.day.slice(5)}</span>
                <div className="h-2 bg-gray-100 rounded flex-1">
                  <div
                    className="h-2 bg-blinkit-green rounded"
                    style={{ width: `${Math.max(3, (row.revenue / maxRevenue) * 100)}%` }}
                  />
                </div>
                <span className="w-16 text-right">{row.orders}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-semibold mb-3">Status Breakdown</h2>
          <div className="space-y-2 text-sm">
            {data.statusBreakdown.map((row) => (
              <div key={row.status} className="flex justify-between border-b border-gray-50 pb-2">
                <span>{row.status.replace(/_/g, ' ')}</span>
                <span>{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-semibold mb-3">Top Products</h2>
          <div className="space-y-2 text-sm">
            {data.topProducts.slice(0, 7).map((row) => (
              <div key={`top-${row.name}`} className="flex justify-between border-b border-gray-50 pb-2">
                <span>{row.name}</span>
                <span>{row.quantity} · {formatCurrency(row.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-semibold mb-3">Low Performing Products</h2>
          <div className="space-y-2 text-sm">
            {data.lowProducts.slice(0, 7).map((row) => (
              <div key={`low-${row.name}`} className="flex justify-between border-b border-gray-50 pb-2">
                <span>{row.name}</span>
                <span>{row.quantity} · {formatCurrency(row.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-semibold mb-2">Funnel Proxy</h2>
        <p className="text-sm text-gray-600">
          Attempts: <b>{data.checkoutAttemptsProxy}</b> · Delivered: <b>{data.statusBreakdown.find((s) => s.status === 'DELIVERED')?.count ?? 0}</b> ·
          Abandoned Pending: <b>{data.abandonedOrdersProxy}</b>
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-semibold mb-3">Staff Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="py-2">Staff</th>
                <th className="py-2">Assigned</th>
                <th className="py-2">Delivered</th>
                <th className="py-2">Completion %</th>
                <th className="py-2">Avg Handle (mins)</th>
              </tr>
            </thead>
            <tbody>
              {data.staffPerformance.length === 0 ? (
                <tr><td className="py-3 text-gray-400" colSpan={5}>No staff activity yet.</td></tr>
              ) : (
                data.staffPerformance.map((row) => (
                  <tr key={row.staffId} className="border-b border-gray-50">
                    <td className="py-2">{row.staffName}</td>
                    <td className="py-2">{row.assignedOrders}</td>
                    <td className="py-2">{row.deliveredOrders}</td>
                    <td className="py-2">{row.completionRate}%</td>
                    <td className="py-2">{row.averageHandleMinutes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
