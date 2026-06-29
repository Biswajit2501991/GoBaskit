'use client';

import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { formatCurrency, getEffectivePrice } from '@/utils/formatter';
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
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow group">
      <Link href={`/product/${product.id}`} className="aspect-square relative overflow-hidden bg-gray-50 p-2 block">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-green-50 text-3xl opacity-60">
            {product.name.charAt(0)}
          </div>
        )}
        {product.isFeatured && (
          <span className="absolute top-2 left-2 bg-blinkit-yellow text-[10px] font-bold px-2 py-0.5 rounded text-gray-900">
            BESTSELLER
          </span>
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-gray-800 text-white text-[11px] font-bold px-2.5 py-1 rounded uppercase">Out of stock</span>
          </div>
        )}
      </Link>

      <div className="px-2.5 pb-2.5 flex flex-col flex-1">
        <Link href={`/product/${product.id}`}>
          <h3 className="font-medium text-gray-800 text-[13px] leading-snug line-clamp-2 min-h-[2.5rem] hover:text-blinkit-green">
            {product.name}
          </h3>
        </Link>
        <p className="text-[11px] text-gray-400 mt-0.5">{product.unit}</p>
        <div className="flex items-end justify-between mt-2">
          <div>
            <p className="font-bold text-gray-900 text-sm">{formatCurrency(price)}</p>
            {product.discount > 0 && (
              <p className="text-[10px] text-gray-400 line-through">{formatCurrency(product.price)}</p>
            )}
          </div>
          {cartQty > 0 ? (
            <div className="flex items-center bg-blinkit-green rounded-lg overflow-hidden">
              <button onClick={() => updateQuantity(product.id, cartQty - 1)} className="w-7 h-7 text-white font-bold hover:bg-blinkit-green-dark">−</button>
              <span className="font-bold text-white text-sm w-5 text-center">{cartQty}</span>
              <button
                onClick={() => updateQuantity(product.id, cartQty + 1)}
                disabled={cartQty >= product.stock}
                className="w-7 h-7 text-white font-bold hover:bg-blinkit-green-dark disabled:opacity-40"
              >+</button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={!inStock}
              className="text-xs uppercase tracking-wide h-7 px-3"
            >
              ADD
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
