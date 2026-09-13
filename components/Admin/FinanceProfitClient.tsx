'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDateTime } from '@/utils/formatter';

type ProfitRow = {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerPaid: number;
  deliveryCharge: number;
  groceryPaid: number;
  paidToShops: number;
  groceryProfit: number;
  costsPending: number;
  unsourcedItemCount: number;
  tickets: string[];
};

type ProfitOverview = {
  from: string;
  to: string;
  totals: {
    customerPaid: number;
    deliveryCharge: number;
    groceryPaid: number;
    paidToShops: number;
    groceryProfit: number;
    costsPending: number;
    orders: number;
  };
  rows: ProfitRow[];
};

export default function FinanceProfitClient() {
  const [data, setData] = useState<ProfitOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    fetch('/api/admin/finance/profit')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (live) setData(json);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-400">Loading profit…</p>;
  }
  if (!data) {
    return <p className="text-sm text-red-500">Could not load finance profit.</p>;
  }

  const { totals } = data;
  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Finance</h1>
        <p className="text-sm text-gray-500">
          Last 30 days. Grocery profit is customer grocery total minus confirmed shop pay (parent + A/B tickets).
          Delivery is shown separately. Unconfirmed shop costs are not treated as ₹0.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat label="Orders" value={String(totals.orders)} />
        <Stat label="Customer paid" value={formatCurrency(totals.customerPaid)} />
        <Stat label="Grocery paid" value={formatCurrency(totals.groceryPaid)} />
        <Stat label="Paid to shops" value={formatCurrency(totals.paidToShops)} />
        <Stat label="Grocery profit" value={formatCurrency(totals.groceryProfit)} />
        <Stat label="Delivery collected" value={formatCurrency(totals.deliveryCharge)} />
      </div>
      {totals.costsPending > 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">
          {formatCurrency(totals.costsPending)} shop costs are still pending confirm and are excluded from profit.
        </p>
      )}
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer paid</th>
              <th className="p-3">Delivery</th>
              <th className="p-3">Paid to shops</th>
              <th className="p-3">Grocery profit</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  No orders in this window.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3">
                    <p className="font-medium">{row.orderNumber}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(row.createdAt)}</p>
                    {row.tickets.length > 0 && (
                      <p className="text-xs text-gray-500">{row.tickets.join(', ')}</p>
                    )}
                    {row.costsPending > 0 && (
                      <p className="text-xs text-amber-700">Costs pending {formatCurrency(row.costsPending)}</p>
                    )}
                    {row.unsourcedItemCount > 0 && (
                      <p className="text-xs text-gray-500">{row.unsourcedItemCount} line(s) with no shop cost</p>
                    )}
                  </td>
                  <td className="p-3">{formatCurrency(row.customerPaid)}</td>
                  <td className="p-3">{formatCurrency(row.deliveryCharge)}</td>
                  <td className="p-3">{formatCurrency(row.paidToShops)}</td>
                  <td className="p-3 font-medium">{formatCurrency(row.groceryProfit)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}
