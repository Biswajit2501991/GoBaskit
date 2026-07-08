'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { useProductVariants } from '@/hooks/useProductVariants';
import { CATEGORY_ICONS } from '@/constants';
import { sizedImageUrl } from '@/utils/image';
import { formatCurrency } from '@/utils/formatter';
import { calculateDiscountPercentage } from '@/utils/pricing';
import type { ProductWithCategory } from '@/types';
import { Button } from '@/components/ui/button';
import ProductPriceDisplay from '@/components/ProductCard/ProductPriceDisplay';
import ProductImageCarousel from '@/components/ProductCard/ProductImageCarousel';
import DiscountRibbon from '@/components/Product/DiscountRibbon';
import VariantSelector from '@/components/Product/VariantSelector';

interface ProductCardProps {
  product: ProductWithCategory;
}

export default function ProductCard({ product }: ProductCardProps) {
  const hydrated = useCartHydrated();
  const { items, addItem, updateQuantity } = useCartStore();
  const { showOptions, options, optionCount, optionsLabel, fromPrice } = useProductVariants(product);

  const cartItem = items.find((i) => i.productId === product.id && !i.variantId);
  const cartQty = hydrated ? (cartItem?.quantity ?? 0) : 0;

  const inStock = product.stock > 0 && product.status === 'ACTIVE';

  // For multi-option products, cycle through each option's distinct image.
  // Variants without their own image fall back to the base image and are
  // de-duplicated, so a single-image product never animates.
  const carouselImages = useMemo(() => {
    if (showOptions) {
      const urls = options
        .map((o) => sizedImageUrl(o.imageUrl, 400))
        .filter((u): u is string => Boolean(u));
      return Array.from(new Set(urls));
    }
    const sized = sizedImageUrl(product.imageUrl, 400);
    return sized ? [sized] : [];
  }, [showOptions, options, product.imageUrl]);

  // Best discount shown on the corner ribbon: for multi-option products this is
  // the maximum discount across every option so the customer sees the best deal.
  const discountPercent = useMemo(() => {
    if (showOptions) {
      return options.reduce(
        (max, o) => Math.max(max, calculateDiscountPercentage(o.mrp, o.price)),
        0,
      );
    }
    return calculateDiscountPercentage(product.actualPrice, product.price);
  }, [showOptions, options, product.actualPrice, product.price]);

  function handleAdd() {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      mrp: product.actualPrice ?? null,
      unit: product.unit,
      imageUrl: product.imageUrl,
      stock: product.stock,
    });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden flex flex-col hover:shadow-sm transition-shadow group">
      <Link href={`/product/${product.id}`} className="block p-2">
        <div className="aspect-[4/5] relative rounded-2xl overflow-hidden bg-gradient-to-br from-yellow-50 to-green-50 border border-gray-100">
          <ProductImageCarousel
            images={carouselImages}
            alt={product.name}
            fallback={<span>{CATEGORY_ICONS[product.category?.slug ?? ''] ?? '🛒'}</span>}
          />
          <DiscountRibbon percent={discountPercent} />
          {!showOptions && !inStock && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <span className="bg-gray-800 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase">Out of stock</span>
            </div>
          )}
        </div>
      </Link>

      <div className="px-2 pb-2 flex flex-col flex-1">
        {product.isFeatured ? (
          <span className="inline-flex self-start bg-blinkit-yellow text-[8px] font-bold px-1.5 py-0.5 rounded text-gray-900 mb-1">
            BESTSELLER
          </span>
        ) : (
          <span className="h-4 mb-1" />
        )}
        <Link href={`/product/${product.id}`}>
          <h3 className="font-medium text-gray-800 text-[11px] leading-tight line-clamp-2 min-h-[1.75rem] hover:text-blinkit-green">
            {product.name}
          </h3>
        </Link>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
          {showOptions ? `${optionCount} option${optionCount === 1 ? '' : 's'}` : product.unit}
        </p>
        <div className="flex items-end justify-between mt-1.5 gap-1">
          <div className="min-w-0">
            {showOptions ? (
              <div>
                <p className="text-[9px] text-gray-400 leading-none">From</p>
                <p className="text-xs font-bold text-gray-900 leading-none mt-0.5">
                  {fromPrice != null ? formatCurrency(fromPrice) : formatCurrency(product.price)}
                </p>
              </div>
            ) : (
              <ProductPriceDisplay price={product.price} actualPrice={product.actualPrice} size="xs" />
            )}
          </div>

          {showOptions ? (
            <VariantSelector product={product} label={optionsLabel} />
          ) : cartQty > 0 ? (
            <div className="flex items-center bg-blinkit-green rounded-md overflow-hidden shrink-0">
              <button onClick={() => updateQuantity(product.id, cartQty - 1)} className="w-6 h-6 text-white text-sm font-bold hover:bg-blinkit-green-dark">−</button>
              <span className="font-bold text-white text-xs w-4 text-center">{cartQty}</span>
              <button
                onClick={() => updateQuantity(product.id, cartQty + 1)}
                disabled={cartQty >= product.stock}
                className="w-6 h-6 text-white text-sm font-bold hover:bg-blinkit-green-dark disabled:opacity-40"
              >+</button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={!inStock}
              className="text-[10px] uppercase tracking-wide h-6 px-2 min-w-[2.75rem] shrink-0"
            >
              ADD
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
