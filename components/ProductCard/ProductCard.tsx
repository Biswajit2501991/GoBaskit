'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { useProductVariants } from '@/hooks/useProductVariants';
import { useConfigStore } from '@/store/configStore';
import { CATEGORY_ICONS } from '@/constants';
import { sizedImageUrl } from '@/utils/image';
import { formatCurrency } from '@/utils/formatter';
import { calculateDiscountPercentage } from '@/utils/pricing';
import type { ProductWithCategory } from '@/types';
import { Button } from '@/components/ui/button';
import ProductPriceDisplay from '@/components/ProductCard/ProductPriceDisplay';
import ProductImageCarousel from '@/components/ProductCard/ProductImageCarousel';
import DiscountRibbon from '@/components/Product/DiscountRibbon';
import BestsellerBadge from '@/components/Product/BestsellerBadge';
import HealthStarRating from '@/components/Product/HealthStarRating';
import HealthStarBadge from '@/components/Product/HealthStarBadge';
import VariantSelector from '@/components/Product/VariantSelector';
import { DEFAULT_HEALTH_STAR_DISPLAY } from '@/constants/healthStarDisplay';

interface ProductCardProps {
  product: ProductWithCategory;
}

export default function ProductCard({ product }: ProductCardProps) {
  const hydrated = useCartHydrated();
  const { items, addItem, updateQuantity } = useCartStore();
  const { showOptions, options, optionCount, optionsLabel, fromPrice } = useProductVariants(product);
  const showHealthStarRating = useConfigStore((s) => s.homepageConfig.showHealthStarRating !== false);
  const healthStarDisplay = useConfigStore(
    (s) => s.homepageConfig.healthStarDisplay ?? DEFAULT_HEALTH_STAR_DISPLAY,
  );
  const fetchConfig = useConfigStore((s) => s.fetchConfig);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const cartItem = items.find((i) => i.productId === product.id && !i.variantId);
  const cartQty = hydrated ? (cartItem?.quantity ?? 0) : 0;
  const inStock = product.stock > 0 && product.status === 'ACTIVE';

  /** Best (highest) health rating among the base product + options, when any are set. */
  const healthRating = useMemo(() => {
    if (!showHealthStarRating) return null;
    const ratings = [
      product.healthStarRating,
      ...options.map((o) => o.healthStarRating),
    ].filter((r): r is number => typeof r === 'number' && r >= 1 && r <= 5);
    if (!ratings.length) return null;
    return Math.max(...ratings);
  }, [showHealthStarRating, product.healthStarRating, options]);

  const showBadge =
    healthRating != null &&
    healthRating >= (healthStarDisplay.badgeMinRating ?? 5) &&
    (healthStarDisplay.mode === 'badge' || healthStarDisplay.mode === 'both') &&
    Boolean(healthStarDisplay.badgeUrl);

  const showStars =
    healthRating != null &&
    (healthStarDisplay.mode === 'stars' || healthStarDisplay.mode === 'both');

  // Show a single, stable image so the card never visually fluctuates. For
  // multi-option products we pick the first available option image (base image
  // preferred), and customers still see every option's photo in the drawer /
  // product page. (Auto-cycling was distracting — options are framed
  // differently, making the product appear to grow/shrink.)
  const carouselImages = useMemo(() => {
    if (showOptions) {
      const first = options
        .map((o) => sizedImageUrl(o.imageUrl, 400))
        .find((u): u is string => Boolean(u));
      return first ? [first] : [];
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
          {showBadge && (
            <HealthStarBadge
              url={healthStarDisplay.badgeUrl}
              position={healthStarDisplay.badgePosition}
            />
          )}
          {!showOptions && !inStock && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <span className="bg-gray-800 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase">Out of stock</span>
            </div>
          )}
        </div>
      </Link>

      <div className="px-2 pb-2 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-0.5 mb-1 min-h-[14px] flex-nowrap">
          {product.isFeatured ? (
            <BestsellerBadge className="relative self-center text-[6.5px] leading-none px-1 py-px tracking-tight" />
          ) : (
            <span className="h-3.5" />
          )}
          {showStars && healthRating != null && (
            <HealthStarRating rating={healthRating} variant="card" className="shrink-0" />
          )}
        </div>
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
