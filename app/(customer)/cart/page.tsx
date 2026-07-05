'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import { useCartStore } from '@/store/cartStore';
import { useConfigStore } from '@/store/configStore';
import { deliveryChargeFrom } from '@/constants';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { formatCurrency } from '@/utils/formatter';
import { Button } from '@/components/ui/button';

export default function CartPage() {
  const hydrated = useCartHydrated();
  const { items, updateQuantity, removeItem, clearCart, getSubtotal } = useCartStore();
  const { deliverySlabs, minOrderValue, fetchConfig } = useConfigStore();

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const subtotal = getSubtotal();
  const deliveryCharge = deliveryChargeFrom(deliverySlabs, subtotal);
  const grandTotal = subtotal + deliveryCharge;
  const belowMinimum = minOrderValue > 0 && subtotal < minOrderValue;

  const imageFetchAttempted = useRef(new Set<string>());

  // Backfill images for items added before product photos were uploaded
  useEffect(() => {
    if (!hydrated) return;
    const missing = items.filter(
      (i) => !i.imageUrl && !imageFetchAttempted.current.has(i.productId)
    );
    if (missing.length === 0) return;

    missing.forEach((i) => imageFetchAttempted.current.add(i.productId));

    Promise.all(
      missing.map(async (item) => {
        try {
          const res = await fetch(`/api/products/${item.productId}`);
          if (!res.ok) return null;
          const product = await res.json();
          return product.imageUrl ? { productId: item.productId, imageUrl: product.imageUrl as string } : null;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      const updates = results.filter(Boolean) as { productId: string; imageUrl: string }[];
      if (updates.length === 0) return;
      useCartStore.setState((state) => ({
        items: state.items.map((i) => {
          const patch = updates.find((u) => u.productId === i.productId);
          return patch ? { ...i, imageUrl: patch.imageUrl } : i;
        }),
      }));
    });
  }, [hydrated, items]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header showSearch={false} />
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header showSearch={false} />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
          <div className="w-24 h-24 bg-blinkit-green-light rounded-full flex items-center justify-center mb-5 text-4xl">🛒</div>
          <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-6 text-sm">Add groceries to get started</p>
          <Button asChild><Link href="/">Start Shopping</Link></Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showSearch={false} />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-28 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">My Cart ({items.length})</h2>
          <button onClick={clearCart} className="text-red-500 text-sm font-medium hover:text-red-600">Clear Cart</button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 divide-y">
          {items.map((item) => (
            <div key={item.productId} className="p-4 flex gap-3">
              <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <span className="text-xl font-bold text-blinkit-green">{item.name.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                <p className="text-xs text-gray-400">{item.unit}</p>
                <p className="font-bold text-sm mt-1">{formatCurrency(item.price)}</p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <button onClick={() => removeItem(item.productId)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                <div className="flex items-center bg-blinkit-green rounded-lg">
                  <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-7 h-7 text-white font-bold">−</button>
                  <span className="text-white font-bold text-sm w-5 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} disabled={item.quantity >= item.stock} className="w-7 h-7 text-white font-bold disabled:opacity-40">+</button>
                </div>
                <p className="text-sm font-bold">{formatCurrency(item.price * item.quantity)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span className="font-medium">{formatCurrency(deliveryCharge)}</span></div>
          <div className="flex justify-between border-t border-dashed pt-2 font-bold text-base">
            <span>Grand Total</span><span className="text-blinkit-green">{formatCurrency(grandTotal)}</span>
          </div>
          {belowMinimum && (
            <p className="text-amber-600 text-xs font-semibold">
              Add {formatCurrency(minOrderValue - subtotal)} more to meet minimum order of {formatCurrency(minOrderValue)}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" asChild className="flex-1"><Link href="/">Continue Shopping</Link></Button>
          <Button asChild className="flex-1"><Link href="/checkout">Checkout</Link></Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
