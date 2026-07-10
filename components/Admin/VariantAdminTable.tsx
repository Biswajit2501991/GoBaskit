'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatter';
import { resolvePublicImageUrl } from '@/utils/image';
import { variantLabel } from '@/utils/variant';
import VariantForm from './VariantForm';
import type { ProductVariant } from '@/types';

interface VariantAdminTableProps {
  productId: string;
  productName?: string;
  categoryName?: string;
  productImageUrl?: string | null;
  onCountChange?: (count: number) => void;
}

export default function VariantAdminTable({
  productId,
  productName,
  categoryName,
  productImageUrl,
  onCountChange,
}: VariantAdminTableProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductVariant | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`);
      if (res.ok) {
        const data = await res.json();
        const items: ProductVariant[] = Array.isArray(data.items) ? data.items : [];
        setVariants(items);
        onCountChange?.(items.length);
      }
    } finally {
      setLoading(false);
    }
  }, [productId, onCountChange]);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(variant: ProductVariant) {
    setEditing(variant);
    setShowForm(true);
  }

  async function handleDelete(variant: ProductVariant) {
    if (!confirm(`Delete option "${variantLabel(variant)}"?`)) return;
    setBusyId(variant.id);
    const res = await fetch(`/api/admin/products/${productId}/variants/${variant.id}`, {
      method: 'DELETE',
    });
    setBusyId(null);
    if (res.ok) await load();
  }

  async function toggleActive(variant: ProductVariant) {
    setBusyId(variant.id);
    const res = await fetch(`/api/admin/products/${productId}/variants/${variant.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: variant.brand,
        variantName: variant.variantName,
        weight: variant.weight,
        unit: variant.unit,
        price: variant.price,
        mrp: variant.mrp,
        sku: variant.sku,
        barcode: variant.barcode,
        stock: variant.stock,
        imageUrl: variant.imageUrl,
        sortOrder: variant.sortOrder,
        isActive: !variant.isActive,
      }),
    });
    setBusyId(null);
    if (res.ok) await load();
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= variants.length) return;
    const reordered = [...variants];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setVariants(reordered);
    await fetch(`/api/admin/products/${productId}/variants/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: reordered.map((v) => v.id) }),
    });
    await load();
  }

  return (
    <div className="md:col-span-2 lg:col-span-3 border border-gray-200 rounded-xl p-4 bg-gray-50/50">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">Variant Management</h3>
          <p className="text-[11px] text-gray-500">
            Each option has its own price and stock. Image can match the product or be unique.
          </p>
          {productName ? (
            <p className="text-[11px] text-blinkit-green mt-1 font-medium">
              Storefront first option = base product “{productName}” (edit fields above). Extra brands/sizes are listed below.
            </p>
          ) : null}
        </div>
        <Button type="button" size="sm" onClick={openAdd} className="gap-1">
          <Plus className="w-3.5 h-3.5" /> Add Option
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">Loading options...</p>
      ) : variants.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No options yet. Click “Add Option” to create the first one.
        </p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-100">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-2 font-semibold w-10">#</th>
                <th className="text-left p-2 font-semibold">Option</th>
                <th className="text-left p-2 font-semibold">Price</th>
                <th className="text-left p-2 font-semibold">Stock</th>
                <th className="text-left p-2 font-semibold">Active</th>
                <th className="text-right p-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, index) => (
                <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-2">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === variants.length - 1}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const thumb = v.imageUrl || productImageUrl;
                        return thumb ? (
                          <img
                            src={resolvePublicImageUrl(thumb)}
                            alt=""
                            className="w-8 h-8 rounded object-cover border border-gray-100"
                            title={v.imageUrl ? 'Option image' : 'Same as product'}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
                            —
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{variantLabel(v)}</p>
                        {v.sku ? <p className="text-[10px] text-gray-400">SKU: {v.sku}</p> : null}
                        {!v.imageUrl && productImageUrl ? (
                          <p className="text-[10px] text-blinkit-green">Same photo as product</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="font-medium">{formatCurrency(v.price)}</span>
                    {v.mrp && v.mrp > v.price ? (
                      <span className="text-[10px] text-gray-400 line-through ml-1">{formatCurrency(v.mrp)}</span>
                    ) : null}
                  </td>
                  <td className="p-2">
                    <span className={v.stock <= 0 ? 'text-red-600 font-medium' : ''}>{v.stock}</span>
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(v)}
                      disabled={busyId === v.id}
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        v.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {v.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-2">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(v)} className="gap-1">
                        <Pencil className="w-3 h-3" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(v)}
                        disabled={busyId === v.id}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <VariantForm
          productId={productId}
          productName={productName}
          categoryName={categoryName}
          productImageUrl={productImageUrl}
          variant={editing}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            void load();
            // Keep product list option counts in sync without remounting the page.
            void import('@/store/adminProductsStore').then(({ useAdminProductsStore }) => {
              const store = useAdminProductsStore.getState();
              const keys = Object.keys(store.lists);
              if (keys.length === 0) {
                void store.fetchProducts({ page: 1, sort: 'name' });
                return;
              }
              // Refresh the first cached list page (typical admin view).
              void store.refreshProducts({ page: 1, sort: 'name' });
            });
          }}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
