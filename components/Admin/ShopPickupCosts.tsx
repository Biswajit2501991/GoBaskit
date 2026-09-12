'use client';

import { useState } from 'react';
import { formatOrderLineLabel } from '@/utils/orderItemName';
import { formatCurrency, formatDateTime } from '@/utils/formatter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type ShopPickupLine = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  costToGobaskit: number;
};

export type ShopPickupRow = {
  id: string;
  ticket: string;
  pickupAt: string;
  costToGobaskit: number;
  costConfirmedAt: string | null;
  shop: { name: string; phone: string };
  items: ShopPickupLine[];
};

export default function ShopPickupCosts({
  fulfillments,
  procurementTotal,
  canEdit,
  compact,
  onSaved,
}: {
  fulfillments: ShopPickupRow[];
  procurementTotal: number;
  canEdit: boolean;
  compact?: boolean;
  onSaved: (shopSourcing: { procurementTotal: number; fulfillments: ShopPickupRow[] }) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const valuesFor = (row: ShopPickupRow) => {
    const draft = drafts[row.id];
    return Object.fromEntries(
      row.items.map((item) => [
        item.id,
        draft?.[item.id] ?? (item.costToGobaskit ? String(item.costToGobaskit) : ''),
      ]),
    );
  };

  async function save(row: ShopPickupRow) {
    const values = valuesFor(row);
    setSavingId(row.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/shop-fulfillments/${row.id}/costs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: row.items.map((item) => ({
            id: item.id,
            costToGobaskit: Number(values[item.id]),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not save costs');
        return;
      }
      if (data.shopSourcing) onSaved(data.shopSourcing);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className={compact ? 'text-[11px] text-gray-700 space-y-1 pt-1 border-t border-gray-50' : 'space-y-3'}>
      <p className={compact ? 'font-semibold' : 'text-xs font-semibold text-gray-500 uppercase tracking-wide'}>
        Shop pickups
      </p>
      {fulfillments.map((row) => {
        const pending = !row.costConfirmedAt;
        const values = valuesFor(row);
        const total = row.items.reduce((sum, item) => {
          const n = Number(values[item.id]);
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        return (
          <div key={row.id} className={compact ? 'space-y-1' : 'bg-gray-50 rounded-lg p-3 space-y-2'}>
            <p className="font-medium">
              {row.ticket} ({row.shop.name} / {row.shop.phone})
              {pending ? (
                <span className="ml-1 text-amber-700 font-semibold">Costs pending</span>
              ) : (
                <span className="ml-1">· pay {formatCurrency(row.costToGobaskit)}</span>
              )}
            </p>
            <p className="text-gray-500">Pickup {formatDateTime(row.pickupAt)}</p>
            <ul className="space-y-1">
              {row.items.map((item) => (
                <li key={item.id} className={canEdit ? 'flex items-center gap-2' : 'leading-snug break-words'}>
                  <span className="flex-1 min-w-0">
                    {formatOrderLineLabel({
                      productName: item.name,
                      quantity: item.quantity,
                      unit: item.unit,
                    })}
                  </span>
                  {canEdit ? (
                    <span className="flex items-center gap-1 shrink-0">
                      <span>₹</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-8 w-20 text-xs"
                        value={values[item.id]}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.id]: { ...valuesFor(row), [item.id]: e.target.value },
                          }))
                        }
                      />
                    </span>
                  ) : pending ? null : (
                    <span> · {formatCurrency(item.costToGobaskit)}</span>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="flex items-center justify-between gap-2">
                <p>Total {formatCurrency(total)}</p>
                <Button
                  type="button"
                  size="sm"
                  disabled={savingId === row.id}
                  onClick={() => void save(row)}
                >
                  {savingId === row.id ? 'Saving…' : pending ? 'Save costs' : 'Update costs'}
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <p className="font-medium">Procurement total {formatCurrency(procurementTotal)}</p>
    </div>
  );
}
