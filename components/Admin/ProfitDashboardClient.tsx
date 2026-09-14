'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDateTime } from '@/utils/formatter';

type OverviewRow = {
  id: string;
  orderNumber: string;
  createdAt: string;
  paidToShops: number;
  paidToGobaskit: number;
  outsourceProfit: number;
  inHouseProfit: number;
  totalProfit: number;
  untaggedCount: number;
  pendingShopCost: number;
  missingInHouseCostCount: number;
  deliveryCharge: number;
  tickets: string[];
};

type Overview = {
  enabled: boolean;
  from: string;
  to: string;
  includeDelivery: boolean;
  totals: {
    orders: number;
    paidToShops: number;
    paidToGobaskit: number;
    outsourceProfit: number;
    inHouseProfit: number;
    totalProfit: number;
    untaggedCount: number;
    pendingShopCost: number;
    deliveryCharge: number;
  };
  rows: OverviewRow[];
};

type OrderDetail = {
  orderNumber: string;
  createdAt: string;
  paidToShops: number;
  paidToGobaskit: number;
  paidToGobaskitGrocery: number;
  outsourceProfit: number;
  inHouseProfit: number;
  totalProfit: number;
  deliveryCharge: number;
  untaggedCount: number;
  pendingShopCost: number;
  shopCostOnInHouse: number;
  missingInHouseCostCount: number;
  tickets: Array<{
    ticket: string;
    itemCount: number;
    outsourceCount: number;
    inHouseCount: number;
    paidToShops: number;
    inHouseCogs: number;
    outsourceSelling: number;
    inHouseSelling: number;
    pendingShopCost: number;
  }>;
  lines: Array<{
    id: string;
    productName: string;
    quantity: number;
    selling: number;
    source: string;
    sourceFrozen: boolean;
    inHouseCogs: number | null;
    missingInHouseCost: boolean;
    shopLineCost: number;
    shopCostOnInHouse: number;
  }>;
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ProfitDashboardClient({ canToggle }: { canToggle: boolean }) {
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [includeDelivery, setIncludeDelivery] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({
      from,
      to,
      includeDelivery: includeDelivery ? '1' : '0',
    });
    const res = await fetch(`/api/admin/profit-dashboard?${qs}`, { cache: 'no-store' });
    const json = res.ok ? await res.json() : null;
    setData(json);
    setEnabled(Boolean(json?.enabled));
    setLoading(false);
  }, [from, to, includeDelivery]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId || !enabled) {
      setDetail(null);
      return;
    }
    let live = true;
    setDetailLoading(true);
    const qs = new URLSearchParams({
      orderId: selectedId,
      includeDelivery: includeDelivery ? '1' : '0',
    });
    fetch(`/api/admin/profit-dashboard?${qs}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (live) setDetail(json?.order ?? null);
      })
      .finally(() => {
        if (live) setDetailLoading(false);
      });
    return () => {
      live = false;
    };
  }, [selectedId, includeDelivery, enabled]);

  async function toggleEnabled() {
    if (!canToggle) return;
    setToggling(true);
    const res = await fetch('/api/admin/profit-dashboard', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    setToggling(false);
    if (!res.ok) {
      alert('Only staff who can edit Settings can turn this dashboard on or off.');
      return;
    }
    await load();
  }

  const totals = data?.totals;
  const selected = useMemo(
    () => data?.rows.find((row) => row.id === selectedId) ?? null,
    [data, selectedId],
  );

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Profit Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            In House vs Outsource cost and profit by order. Finance Desk is unchanged.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm font-medium">
          <span>Dashboard</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={!canToggle || toggling}
            onClick={() => void toggleEnabled()}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              enabled ? 'bg-blinkit-green' : 'bg-gray-300'
            } disabled:opacity-60`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
          <span className="text-gray-500 font-normal">{enabled ? 'On' : 'Off'}</span>
        </label>
      </div>

      {!enabled ? (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-4">
          Turn the switch on to compute In House / Outsource profit. Tag products on the Products page first.
          {canToggle ? '' : ' Ask a Super Admin to enable this section.'}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 block h-10 rounded-lg border border-gray-200 px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 block h-10 rounded-lg border border-gray-200 px-3 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={includeDelivery}
                onChange={(e) => setIncludeDelivery(e.target.checked)}
              />
              Include delivery in GoBaskit profit
            </label>
          </div>

          {loading || !totals ? (
            <p className="text-sm text-gray-400">Loading profit…</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Orders" value={String(totals.orders)} />
                <Stat label="Paid to shops" value={formatCurrency(totals.paidToShops)} />
                <Stat label="Paid to GoBaskit" value={formatCurrency(totals.paidToGobaskit)} />
                <Stat label="Total profit" value={formatCurrency(totals.totalProfit)} />
                <Stat label="Outsource profit" value={formatCurrency(totals.outsourceProfit)} />
                <Stat label="In-house profit" value={formatCurrency(totals.inHouseProfit)} />
                <Stat label="Untagged items" value={String(totals.untaggedCount)} />
                <Stat label="Pending shop cost" value={formatCurrency(totals.pendingShopCost)} />
              </div>

              <div className="bg-white rounded-xl border overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-3">Order</th>
                      <th className="text-right p-3">Shops</th>
                      <th className="text-right p-3">GoBaskit</th>
                      <th className="text-right p-3">Outsource profit</th>
                      <th className="text-right p-3">In-house profit</th>
                      <th className="text-right p-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">
                          No orders in this date range.
                        </td>
                      </tr>
                    ) : (
                      data?.rows.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-b border-gray-50 cursor-pointer ${
                            selectedId === row.id ? 'bg-blinkit-green-light' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedId(row.id)}
                        >
                          <td className="p-3">
                            <p className="font-semibold">{row.orderNumber}</p>
                            <p className="text-xs text-gray-500">{formatDateTime(row.createdAt)}</p>
                            {row.untaggedCount > 0 && (
                              <p className="text-xs text-amber-700">{row.untaggedCount} untagged</p>
                            )}
                          </td>
                          <td className="p-3 text-right">{formatCurrency(row.paidToShops)}</td>
                          <td className="p-3 text-right">{formatCurrency(row.paidToGobaskit)}</td>
                          <td className="p-3 text-right">{formatCurrency(row.outsourceProfit)}</td>
                          <td className="p-3 text-right">{formatCurrency(row.inHouseProfit)}</td>
                          <td className="p-3 text-right font-medium">{formatCurrency(row.totalProfit)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {selectedId && (
                <div className="bg-white rounded-xl border p-5 space-y-4">
                  <div className="flex justify-between gap-3">
                    <h2 className="font-semibold">{selected?.orderNumber ?? 'Order'} details</h2>
                    <button type="button" className="text-sm text-gray-500" onClick={() => setSelectedId(null)}>
                      Close
                    </button>
                  </div>
                  {detailLoading || !detail ? (
                    <p className="text-sm text-gray-400">Loading lines…</p>
                  ) : (
                    <>
                      {detail.tickets.map((ticket) => (
                        <div key={ticket.ticket} className="rounded-lg border border-gray-100 p-3">
                          <p className="font-semibold text-sm">{ticket.ticket}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {ticket.itemCount} items · {ticket.outsourceCount} outsource · {ticket.inHouseCount} in house
                          </p>
                          <p className="text-sm mt-2">
                            To shops {formatCurrency(ticket.paidToShops)} · In house cost {formatCurrency(ticket.inHouseCogs)}
                          </p>
                        </div>
                      ))}
                      <p className="text-sm">
                        Paid to shops {formatCurrency(detail.paidToShops)} · Paid to GoBaskit{' '}
                        {formatCurrency(detail.paidToGobaskit)}
                        {includeDelivery ? ` (includes delivery ${formatCurrency(detail.deliveryCharge)})` : ''}
                      </p>
                      <p className="text-sm font-medium">
                        Outsource profit {formatCurrency(detail.outsourceProfit)} · In-house profit{' '}
                        {formatCurrency(detail.inHouseProfit)} · Total {formatCurrency(detail.totalProfit)}
                      </p>
                      {detail.shopCostOnInHouse > 0 && (
                        <p className="text-xs text-amber-800">
                          Shops also entered {formatCurrency(detail.shopCostOnInHouse)} on in-house lines.
                        </p>
                      )}
                      <ul className="text-sm divide-y">
                        {detail.lines.map((line) => (
                          <li key={line.id} className="py-2 flex justify-between gap-3">
                            <span>
                              {line.productName} × {line.quantity}
                              <span className="ml-2 text-xs text-gray-500">
                                {line.source === 'UNSET' ? 'Untagged' : line.source === 'IN_HOUSE' ? 'In house' : 'Outsource'}
                                {line.sourceFrozen ? '' : ' (live tag)'}
                                {line.missingInHouseCost ? ' · missing cost' : ''}
                              </span>
                            </span>
                            <span>{formatCurrency(line.selling)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  );
}
