'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type CatalogItem = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  assigned: boolean;
  atCap: boolean;
};

export default function ShopProductCatalog({
  shopId,
  shopName,
  canEdit,
  onClose,
}: {
  shopId: string;
  shopName: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [maxShops, setMaxShops] = useState(3);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/products`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not load products');
        return;
      }
      const next = Array.isArray(data.items) ? (data.items as CatalogItem[]) : [];
      setItems(next);
      setMaxShops(typeof data.maxShopsPerItem === 'number' ? data.maxShopsPerItem : 3);
      setChecked(Object.fromEntries(next.map((row) => [row.id, row.assigned])));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of items) {
      if (!map.has(row.categoryId)) map.set(row.categoryId, row.categoryName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (categoryId && row.categoryId !== categoryId) return false;
      if (q && !row.name.toLowerCase().includes(q) && !row.categoryName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [items, categoryId, search]);

  const assignedCount = Object.values(checked).filter(Boolean).length;
  const visibleChecked = visible.filter((row) => checked[row.id]).length;

  function setVisible(next: boolean) {
    setChecked((prev) => {
      const copy = { ...prev };
      for (const row of visible) {
        if (next && row.atCap && !row.assigned && !prev[row.id]) continue;
        copy[row.id] = next;
      }
      return copy;
    });
  }

  async function save() {
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const productIds = items.filter((row) => checked[row.id]).map((row) => row.id);
      const res = await fetch(`/api/admin/shops/${shopId}/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not save');
        return;
      }
      const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0;
      setInfo(
        skipped
          ? `Saved. ${data.assigned} tagged. ${skipped} skipped (already at ${maxShops} shops).`
          : `Saved. ${data.assigned} products tagged to this shop.`,
      );
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function applyCategory(assigned: boolean) {
    if (!categoryId) {
      setError('Choose a category first');
      return;
    }
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/products/category`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, assigned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not update category');
        return;
      }
      const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0;
      setInfo(
        assigned
          ? skipped
            ? `Category tagged. ${skipped} items skipped (already at ${maxShops} shops).`
            : 'Whole category tagged to this shop.'
          : `Removed this shop from ${data.removed ?? 0} items in the category.`,
      );
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border rounded-2xl p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Products at {shopName}</h2>
          <p className="text-sm text-gray-500">
            Tick what this shop sells, then Save. Other shops on those products are not changed.
            An item can be on at most {maxShops} shops.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500">Category</label>
          <select
            className="mt-1 block border rounded-lg px-3 py-2 text-sm bg-white min-w-[180px]"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs text-gray-500">Search</label>
          <Input className="mt-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Product name" />
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={saving || loading} onClick={() => setVisible(true)}>
            Select all visible
          </Button>
          <Button type="button" variant="secondary" disabled={saving || loading} onClick={() => setVisible(false)}>
            Clear visible
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving || loading || !categoryId}
            onClick={() => void applyCategory(true)}
          >
            Assign this category
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving || loading || !categoryId}
            onClick={() => void applyCategory(false)}
          >
            Remove this category
          </Button>
          <Button type="button" disabled={saving || loading} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}

      <p className="text-xs text-gray-500">
        {assignedCount} tagged · {visibleChecked}/{visible.length} visible selected
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-emerald-700">{info}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading products…</p>
      ) : (
        <ul className="max-h-[480px] overflow-y-auto divide-y border rounded-xl">
          {visible.map((row) => {
            const locked = row.atCap && !checked[row.id];
            return (
              <li key={row.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!canEdit || locked || saving}
                  checked={checked[row.id] === true}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [row.id]: e.target.checked }))}
                />
                <span className="flex-1">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-gray-400"> · {row.categoryName}</span>
                </span>
                {locked && <span className="text-xs text-amber-700">At shop limit</span>}
              </li>
            );
          })}
          {!visible.length && <li className="px-3 py-6 text-sm text-gray-500">No products in this filter.</li>}
        </ul>
      )}
    </div>
  );
}
