'use client';

import Link from 'next/link';
import { useCartStore, cartLineKey } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { CATEGORY_ICONS } from '@/constants';
import { resolvePublicImageUrl } from '@/utils/image';
import { formatCurrency } from '@/utils/formatter';
import { minVariantPrice } from '@/utils/variant';
import type { ProductWithCategory } from '@/types';
import { Button } from '@/components/ui/button';
import ProductPriceDisplay from '@/components/ProductCard/ProductPriceDisplay';
import VariantSelector, { addVariantToCart } from '@/components/Product/VariantSelector';

interface ProductCardProps {
  product: ProductWithCategory;
}

export default function ProductCard({ product }: ProductCardProps) {
  const hydrated = useCartHydrated();
  const { items, addItem, updateQuantity } = useCartStore();

  const activeVariants = product.variants ?? [];
  const showVariants = (product.hasVariants ?? false) && activeVariants.length > 1;
  const singleVariant =
    (product.hasVariants ?? false) && activeVariants.length === 1 ? activeVariants[0] : null;

  const lineKey = singleVariant ? cartLineKey(product.id, singleVariant.id) : product.id;
  const cartItem = items.find((i) => cartLineKey(i.productId, i.variantId) === lineKey);
  const cartQty = hydrated ? (cartItem?.quantity ?? 0) : 0;

  const effectivePrice = singleVariant ? singleVariant.price : product.price;
  const effectiveActual = singleVariant ? singleVariant.mrp ?? null : product.actualPrice;
  const effectiveStock = singleVariant ? singleVariant.stock : product.stock;
  const inStock = singleVariant
    ? singleVariant.stock > 0
    : product.stock > 0 && product.status === 'ACTIVE';
  const imageUrl = resolvePublicImageUrl(product.imageUrl);
  const fromPrice = showVariants ? minVariantPrice(activeVariants) : null;

  function handleAdd() {
    if (singleVariant) {
      addVariantToCart(addItem, product, singleVariant);
      return;
    }
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      imageUrl: product.imageUrl,
      stock: product.stock,
    });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden flex flex-col hover:shadow-sm transition-shadow group">
      <Link href={`/product/${product.id}`} className="block p-2">
        <div className="aspect-[4/5] relative rounded-2xl overflow-hidden bg-gradient-to-br from-yellow-50 to-green-50 border border-gray-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              <span>{CATEGORY_ICONS[product.category?.slug ?? ''] ?? '🛒'}</span>
            </div>
          )}
          {!showVariants && !inStock && (
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
          {showVariants ? `${activeVariants.length} options` : singleVariant ? (`${singleVariant.weight}${singleVariant.unit}`.trim() || product.unit) : product.unit}
        </p>
        <div className="flex items-end justify-between mt-1.5 gap-1">
          <div className="min-w-0">
            {showVariants ? (
              <div>
                <p className="text-[9px] text-gray-400 leading-none">From</p>
                <p className="text-xs font-bold text-gray-900 leading-none mt-0.5">
                  {fromPrice != null ? formatCurrency(fromPrice) : formatCurrency(product.price)}
                </p>
              </div>
            ) : (
              <ProductPriceDisplay price={effectivePrice} actualPrice={effectiveActual} size="xs" />
            )}
          </div>

          {showVariants ? (
            <VariantSelector product={product} variants={activeVariants} label="Options" />
          ) : cartQty > 0 ? (
            <div className="flex items-center bg-blinkit-green rounded-md overflow-hidden shrink-0">
              <button onClick={() => updateQuantity(lineKey, cartQty - 1)} className="w-6 h-6 text-white text-sm font-bold hover:bg-blinkit-green-dark">−</button>
              <span className="font-bold text-white text-xs w-4 text-center">{cartQty}</span>
              <button
                onClick={() => updateQuantity(lineKey, cartQty + 1)}
                disabled={cartQty >= effectiveStock}
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
