'use client';

import { formatCurrency } from '@/utils/formatter';
import { getListPrice, formatDiscountBadge } from '@/utils/pricing';
import { resolvePublicImageUrl } from '@/utils/image';
import { variantLabel, variantIsInStock, variantImageUrl, variantSizeLabel } from '@/utils/variant';
import { Button } from '@/components/ui/button';
import type { ProductVariant, ProductWithCategory } from '@/types';

interface VariantCardProps {
  variant: ProductVariant;
  product: Pick<ProductWithCategory, 'imageUrl'>;
  inCartQty?: number;
  onAdd: (variant: ProductVariant) => void;
}

export default function VariantCard({ variant, product, inCartQty = 0, onAdd }: VariantCardProps) {
  const label = variantLabel(variant);
  const listPrice = getListPrice(variant.mrp ?? null, variant.price);
  const discountLabel = formatDiscountBadge(variant.mrp ?? null, variant.price);
  const inStock = variantIsInStock(variant);
  const imageUrl = resolvePublicImageUrl(variantImageUrl(variant, product));
  const sizeLabel = variantSizeLabel(variant);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        inStock ? 'border-gray-100 bg-white hover:border-blinkit-green/30' : 'border-gray-100 bg-gray-50 opacity-75'
      }`}
    >
      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-yellow-50 to-green-50 border border-gray-100 flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={label} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-blinkit-green">
            {(variant.brand || label).charAt(0)}
          </div>
        )}
        {discountLabel ? (
          <span className="absolute top-0 left-0 bg-blue-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-br-md leading-none">
            {discountLabel}
          </span>
        ) : null}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
        {sizeLabel ? (
          <p className="text-xs text-gray-500 mt-0.5">{sizeLabel}</p>
        ) : null}
        <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
          <span className="text-sm font-bold text-gray-900">{formatCurrency(variant.price)}</span>
          {listPrice ? (
            <span className="text-[11px] text-gray-400 line-through">{formatCurrency(listPrice)}</span>
          ) : null}
        </div>
        {!inStock ? (
          <p className="text-[11px] font-semibold text-red-500 mt-0.5">Out of stock</p>
        ) : null}
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={!inStock}
        onClick={() => onAdd(variant)}
        className="text-[11px] uppercase tracking-wide h-8 px-4 shrink-0 border-blinkit-green text-blinkit-green hover:bg-blinkit-green-light"
      >
        {inCartQty > 0 ? `${inCartQty}` : 'ADD'}
      </Button>
    </div>
  );
}
