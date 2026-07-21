'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/utils/formatter';

type CategoryOption = { id: string; name: string };

type PreviewRow = {
  kind: 'product' | 'variant';
  id: string;
  name: string;
  categoryName: string;
  beforePrice: number;
  afterPrice: number;
  beforeMrp: number | null;
  afterMrp: number | null;
};

type PreviewResult = {
  percent: number;
  categoryId: string | null;
  categoryName: string | null;
  productCount: number;
  variantCount: number;
  skipped: number;
  sample: PreviewRow[];
};

type UndoInfo = {
  available: boolean;
  undo: {
    id: string;
    createdAt: string;
    expiresAt: string;
    percent: number;
    categoryName: string | null;
    products: unknown[];
    variants: unknown[];
  } | null;
};

type ConfirmKind = 'apply' | 'undo' | null;

function money(n: number | null | undefined) {
  if (n == null) return '—';
  return formatCurrency(n);
}

export default function BulkPriceAdjustClient({ canEdit }: { canEdit: boolean }) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [percent, setPercent] = useState('10');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadUndo = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products/bulk-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'status' }),
      });
      if (res.ok) setUndo(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetch('/api/admin/categories?pageSize=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items ?? data?.categories ?? [];
        setCategories(
          (list as Array<{ id: string; name: string }>).map((c) => ({
            id: c.id,
            name: c.name,
          })),
        );
      })
      .catch(() => {});
    void loadUndo();
  }, [loadUndo]);

  async function runPreview() {
    if (!canEdit) return;
    setLoading(true);
    setMessage(null);
    setPreview(null);
    try {
      const res = await fetch('/api/admin/products/bulk-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'preview',
          percent: Number(percent),
          categoryId: categoryId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setPreview(data);
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Preview failed' });
    } finally {
      setLoading(false);
    }
  }

  async function executeApply() {
    if (!canEdit || !preview) return;
    setConfirmKind(null);
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/products/bulk-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'apply',
          percent: preview.percent,
          categoryId: preview.categoryId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Apply failed');
      setMessage({
        type: 'ok',
        text: `Updated ${data.updatedProducts} products and ${data.updatedVariants} variants. Undo available for 24 hours.`,
      });
      setPreview(null);
      await loadUndo();
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Apply failed' });
    } finally {
      setLoading(false);
    }
  }

  async function executeUndo() {
    if (!canEdit || !undo?.available) return;
    setConfirmKind(null);
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/products/bulk-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'undo' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Undo failed');
      setMessage({
        type: 'ok',
        text: `Restored ${data.restoredProducts} products and ${data.restoredVariants} variants.`,
      });
      await loadUndo();
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Undo failed' });
    } finally {
      setLoading(false);
    }
  }

  const applyScope = preview?.categoryName
    ? `category “${preview.categoryName}”`
    : 'ALL products';

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Bulk Price Adjust</h1>
        <p className="text-sm text-gray-500">
          Raise or lower selling price and MRP together by a percentage — all items or one
          category. Preview first, then apply. Undo restores the last batch for 24 hours.
          Past orders are never changed.
        </p>
      </div>

      {!canEdit && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          You need products:edit permission to run price adjusts.
        </p>
      )}

      <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-gray-500">Category</Label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPreview(null);
              }}
              disabled={!canEdit || loading}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">
              Percent change (+10 = increase 10%, −10 = decrease 10%)
            </Label>
            <Input
              type="number"
              step="0.1"
              min={-90}
              max={500}
              value={percent}
              onChange={(e) => {
                setPercent(e.target.value);
                setPreview(null);
              }}
              disabled={!canEdit || loading}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={runPreview} disabled={!canEdit || loading}>
            {loading ? 'Working…' : 'Preview'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmKind('apply')}
            disabled={!canEdit || loading || !preview}
            className="border-blinkit-green text-blinkit-green"
          >
            Apply to catalog
          </Button>
        </div>

        {message && (
          <p
            className={`text-sm rounded-lg px-3 py-2 ${
              message.type === 'ok'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </p>
        )}
      </section>

      {undo?.undo && (
        <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
          <h2 className="font-semibold text-sm">Last adjust / Undo</h2>
          <p className="text-sm text-gray-600">
            {undo.undo.percent}% on{' '}
            {undo.undo.categoryName ? `“${undo.undo.categoryName}”` : 'all categories'} ·{' '}
            {undo.undo.products.length} products, {undo.undo.variants.length} variants ·{' '}
            {new Date(undo.undo.createdAt).toLocaleString()}
          </p>
          {undo.available ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmKind('undo')}
              disabled={!canEdit || loading}
            >
              Undo last adjust
            </Button>
          ) : (
            <p className="text-xs text-gray-400">Undo window expired.</p>
          )}
        </section>
      )}

      {preview && (
        <section className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-sm">Preview</h2>
            <p className="text-xs text-gray-500 mt-1">
              {preview.percent}% · {preview.productCount} products · {preview.variantCount}{' '}
              variants
              {preview.skipped ? ` · ${preview.skipped} would be skipped` : ''}
              {preview.categoryName ? ` · ${preview.categoryName}` : ' · all categories'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium">Selling</th>
                  <th className="px-4 py-2 font-medium">MRP</th>
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-t border-gray-50">
                    <td className="px-4 py-2">
                      <span className="font-medium text-gray-900">{row.name}</span>
                      <span className="block text-[11px] text-gray-400">
                        {row.kind} · {row.categoryName}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-gray-400 line-through mr-1">
                        {money(row.beforePrice)}
                      </span>
                      <span className="font-semibold text-blinkit-green">
                        {money(row.afterPrice)}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-gray-400 line-through mr-1">
                        {money(row.beforeMrp)}
                      </span>
                      <span className="font-semibold">{money(row.afterMrp)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.productCount + preview.variantCount > preview.sample.length && (
            <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-50">
              Showing first {preview.sample.length} rows — apply updates the full selection.
            </p>
          )}
        </section>
      )}

      <Dialog
        open={confirmKind === 'apply' && Boolean(preview)}
        onOpenChange={(open) => {
          if (!open && !loading) setConfirmKind(null);
        }}
      >
        <DialogContent className="max-w-md" showClose={!loading}>
          <DialogHeader>
            <DialogTitle>Apply price change?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1 text-left">
                <p>
                  Apply{' '}
                  <span className="font-semibold text-gray-800">{preview?.percent}%</span> to
                  selling price and MRP for{' '}
                  <span className="font-semibold text-gray-800">{applyScope}</span>.
                </p>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-sm text-gray-700">
                  <p className="font-medium">
                    {preview?.productCount ?? 0} products · {preview?.variantCount ?? 0} variants
                  </p>
                  {preview?.skipped ? (
                    <p className="text-xs text-amber-700 mt-1">
                      {preview.skipped} item(s) will be skipped (invalid result).
                    </p>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500">
                  You can undo this adjust within 24 hours. Past orders are never changed.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmKind(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={executeApply} disabled={loading}>
              {loading ? 'Applying…' : 'Apply to catalog'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmKind === 'undo'}
        onOpenChange={(open) => {
          if (!open && !loading) setConfirmKind(null);
        }}
      >
        <DialogContent className="max-w-md" showClose={!loading}>
          <DialogHeader>
            <DialogTitle>Undo last price adjust?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1 text-left">
                <p>Restore previous selling prices and MRP from the last bulk adjust.</p>
                {undo?.undo && (
                  <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-sm text-gray-700">
                    <p className="font-medium">
                      {undo.undo.percent}% ·{' '}
                      {undo.undo.categoryName
                        ? `“${undo.undo.categoryName}”`
                        : 'all categories'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {undo.undo.products.length} products · {undo.undo.variants.length} variants
                    </p>
                  </div>
                )}
                <p className="text-xs text-amber-700">
                  This cannot be re-done after undo. A new adjust will create a fresh undo
                  snapshot.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmKind(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={executeUndo} disabled={loading}>
              {loading ? 'Restoring…' : 'Undo last adjust'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
