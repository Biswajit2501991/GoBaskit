'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/utils/formatter';
import type { ProductWithCategory } from '@/types';
import { getActiveVariants } from '@/utils/variant';

export type EditableLine = {
  productId: string;
  variantId: string | null;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

type Props = {
  lines: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  disabled?: boolean;
};

export default function OrderContentsEditor({ lines, onChange, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ProductWithCategory[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/products?search=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setHits(Array.isArray(data) ? data.slice(0, 8) : []))
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function setQty(index: number, quantity: number) {
    const next = [...lines];
    next[index] = { ...next[index], quantity: Math.max(1, quantity) };
    onChange(next);
  }

  function removeLine(index: number) {
    const next = lines.filter((_, i) => i !== index);
    if (next.length) onChange(next);
  }

  function addProduct(product: ProductWithCategory) {
    const variants = getActiveVariants(product.variants);
    const variant = variants[0] ?? null;
    const variantId = variant?.id ?? null;
    const unitPrice = variant ? variant.price : product.price;
    const unit = (variant?.unit || product.unit || 'pcs').trim() || 'pcs';
    const productName = variant
      ? `${product.name} (${[variant.brand, variant.variantName, variant.weight, variant.unit].filter(Boolean).join(' ')})`
      : product.name;
    const existing = lines.findIndex((l) => l.productId === product.id && (l.variantId ?? null) === variantId);
    if (existing >= 0) {
      setQty(existing, lines[existing].quantity + 1);
    } else {
      onChange([...lines, { productId: product.id, variantId, productName, quantity: 1, unit, unitPrice }]);
    }
    setQuery('');
    setHits([]);
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {lines.map((line, index) => (
          <li key={`${line.productId}-${line.variantId ?? 'base'}-${index}`} className="flex items-center gap-2 text-sm">
            <span className="flex-1 min-w-0 leading-snug">{line.productName}</span>
            <Input
              type="number"
              min={1}
              value={line.quantity}
              disabled={disabled}
              onChange={(e) => setQty(index, Number(e.target.value))}
              className="w-16 h-8 text-center"
            />
            <span className="w-16 text-right font-medium">{formatCurrency(line.unitPrice * line.quantity)}</span>
            <button
              type="button"
              disabled={disabled || lines.length <= 1}
              onClick={() => removeLine(index)}
              className="text-xs text-red-600 disabled:text-gray-300"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div>
        <Input
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search to add a product"
          className="h-9"
        />
        {searching && <p className="text-xs text-gray-400 mt-1">Searching…</p>}
        {hits.length > 0 && (
          <ul className="mt-1 border rounded-lg divide-y max-h-40 overflow-y-auto bg-white">
            {hits.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => addProduct(p)}
                >
                  {p.name} · {formatCurrency(p.price)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
