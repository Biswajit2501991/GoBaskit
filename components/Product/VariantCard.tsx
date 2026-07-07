'use client';

import { formatCurrency } from '@/utils/formatter';
import { getListPrice } from '@/utils/pricing';
import { resolvePublicImageUrl } from '@/utils/image';
import { variantLabel, variantIsInStock } from '@/utils/variant';
import { Button } from '@/components/ui/button';
import type { ProductVariant } from '@/types';

interface VariantCardProps {
  variant: ProductVariant;
  inCartQty?: number;
  onAdd: (variant: ProductVariant) => void;
}

export default function VariantCard({ variant, inCartQty = 0, onAdd }: VariantCardProps) {
  const label = variantLabel(variant);
  const listPrice = getListPrice(variant.mrp ?? null, variant.price);
  const inStock = variantIsInStock(variant);
  const imageUrl = resolvePublicImageUrl(variant.imageUrl);
  const lowStock = inStock && variant.stock <= 5;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        inStock ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-70'
      }`}
    >
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-yellow-50 to-green-50 border border-gray-100 flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={label} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-blinkit-green">
            {(variant.brand || label).charAt(0)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {variant.brand ? (
          <p className="text-sm font-semibold text-gray-900 truncate">{variant.brand}</p>
        ) : null}
        <p className="text-xs text-gray-500 truncate">
          {[variant.variantName, `${variant.weight}${variant.unit}`.trim()].filter(Boolean).join(' · ')}
        </p>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-sm font-bold text-gray-900">{formatCurrency(variant.price)}</span>
          {listPrice ? (
            <span className="text-[11px] text-gray-400 line-through">{formatCurrency(listPrice)}</span>
          ) : null}
          {variant.discount > 0 ? (
            <span className="text-[10px] font-bold text-blinkit-green">{Math.round(variant.discount)}% OFF</span>
          ) : null}
        </div>
        {!inStock ? (
          <p className="text-[11px] font-semibold text-red-500 mt-0.5">Out of stock</p>
        ) : lowStock ? (
          <p className="text-[11px] font-semibold text-amber-600 mt-0.5">Only {variant.stock} left</p>
        ) : null}
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={!inStock}
        onClick={() => onAdd(variant)}
        className="text-[11px] uppercase tracking-wide h-8 px-4 shrink-0"
      >
        {inCartQty > 0 ? `Added · ${inCartQty}` : 'Add'}
      </Button>
    </div>
  );
}
