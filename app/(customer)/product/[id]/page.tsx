'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { formatCurrency, getEffectivePrice } from '@/utils/formatter';
import { Button } from '@/components/ui/button';
import type { ProductWithCategory } from '@/types';

export default function ProductPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<ProductWithCategory | null>(null);
  const hydrated = useCartHydrated();
  const { items, addItem, updateQuantity } = useCartStore();
  const cartItem = items.find((i) => i.productId === id);
  const cartQty = hydrated ? (cartItem?.quantity ?? 0) : 0;

  useEffect(() => {
    fetch(`/api/products/${id}`).then((r) => r.json()).then(setProduct);
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showSearch={false} />
        <div className="max-w-lg mx-auto p-8 skeleton h-96 rounded-xl mt-8" />
      </div>
    );
  }

  const price = getEffectivePrice(product.price, product.discount);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showSearch={false} />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <Link href="/" className="text-sm text-gray-500 hover:text-blinkit-green mb-4 inline-block">← Back to shop</Link>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="aspect-square bg-gray-50 flex items-center justify-center p-8">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-6xl opacity-40">{product.name.charAt(0)}</span>
            )}
          </div>
          <div className="p-5 space-y-3">
            <span className="text-xs font-semibold text-blinkit-green uppercase">{product.category?.name}</span>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="text-gray-500 text-sm">{product.description}</p>
            <p className="text-sm text-gray-400">{product.unit}</p>
            <p className="text-2xl font-bold">{formatCurrency(price)}</p>

            {cartQty > 0 ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-blinkit-green rounded-lg">
                  <button onClick={() => updateQuantity(id, cartQty - 1)} className="w-10 h-10 text-white font-bold text-xl">−</button>
                  <span className="text-white font-bold w-8 text-center">{cartQty}</span>
                  <button onClick={() => updateQuantity(id, cartQty + 1)} disabled={cartQty >= product.stock} className="w-10 h-10 text-white font-bold text-xl disabled:opacity-40">+</button>
                </div>
                <Button asChild variant="secondary"><Link href="/cart">View Cart</Link></Button>
              </div>
            ) : (
              <Button
                size="lg"
                className="w-full"
                disabled={product.stock <= 0}
                onClick={() => addItem({ productId: product.id, name: product.name, price, unit: product.unit, imageUrl: product.imageUrl, stock: product.stock })}
              >
                ADD TO CART
              </Button>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
