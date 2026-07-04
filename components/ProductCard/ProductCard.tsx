'use client';

import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { formatCurrency, getEffectivePrice } from '@/utils/formatter';
import { CATEGORY_ICONS } from '@/constants';
import type { ProductWithCategory } from '@/types';
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: ProductWithCategory;
}

export default function ProductCard({ product }: ProductCardProps) {
  const hydrated = useCartHydrated();
  const { items, addItem, updateQuantity } = useCartStore();
  const cartItem = items.find((i) => i.productId === product.id);
  const cartQty = hydrated ? (cartItem?.quantity ?? 0) : 0;
  const price = getEffectivePrice(product.price, product.discount);
  const inStock = product.stock > 0 && product.status === 'ACTIVE';

  function handleAdd() {
    addItem({
      productId: product.id,
      name: product.name,
      price,
      unit: product.unit,
      imageUrl: product.imageUrl,
      stock: product.stock,
    });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden flex flex-col hover:shadow-sm transition-shadow group">
      <Link href={`/product/${product.id}`} className="aspect-[4/5] relative overflow-hidden bg-gray-50 p-1.5 block">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 text-4xl">
            <span>{CATEGORY_ICONS[product.category?.slug ?? ''] ?? '🛒'}</span>
          </div>
        )}
        {product.isFeatured && (
          <span className="absolute top-1 left-1 bg-blinkit-yellow text-[8px] font-bold px-1.5 py-0.5 rounded text-gray-900">
            BESTSELLER
          </span>
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-gray-800 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase">Out of stock</span>
          </div>
        )}
      </Link>

      <div className="px-2 pb-2 flex flex-col flex-1">
        <Link href={`/product/${product.id}`}>
          <h3 className="font-medium text-gray-800 text-[11px] leading-tight line-clamp-2 min-h-[1.75rem] hover:text-blinkit-green">
            {product.name}
          </h3>
        </Link>
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{product.unit}</p>
        <div className="flex items-end justify-between mt-1.5 gap-1">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-xs leading-none">{formatCurrency(price)}</p>
            {product.discount > 0 && (
              <p className="text-[9px] text-gray-400 line-through">{formatCurrency(product.price)}</p>
            )}
          </div>
          {cartQty > 0 ? (
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
