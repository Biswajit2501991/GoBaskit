'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import CartPanelContent from '@/components/Cart/CartPanelContent';
import StockRemovalNotice from '@/components/Cart/StockRemovalNotice';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { refreshCartStockFromServer } from '@/utils/refreshCartStock';
import { Button } from '@/components/ui/button';

export default function CartPage() {
  const hydrated = useCartHydrated();
  const itemCount = useCartStore((s) => s.getItemCount());
  const itemsLength = useCartStore((s) => s.items.length);

  useEffect(() => {
    if (!hydrated || itemsLength === 0) return;
    void refreshCartStockFromServer();
  }, [hydrated, itemsLength]);

  if (!hydrated) {
    return (
      <div className="h-dvh max-h-dvh flex flex-col overflow-hidden bg-gray-50">
        <Header showSearch={false} />
        <div className="flex-1 min-h-0 overflow-y-auto max-w-lg mx-auto w-full px-4 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="min-h-dvh flex flex-col bg-gray-50 overflow-x-hidden">
        <Header showSearch={false} />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
          <StockRemovalNotice className="w-full max-w-sm mb-4 text-left" />
          <div className="w-24 h-24 bg-blinkit-green-light rounded-full flex items-center justify-center mb-5 text-4xl">
            🛒
          </div>
          <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-6 text-sm">Add groceries to get started</p>
          <Button asChild>
            <Link href="/">Start Shopping</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  // Lock the page to the visible viewport so the sticky header never overlaps
  // "My Cart" / checkout CTAs (the old 100svh-4.5rem calc was far too tall).
  return (
    <div className="h-dvh max-h-dvh flex flex-col overflow-hidden bg-[#f4f6fb]">
      <Header showSearch={false} />
      <main className="flex-1 min-h-0 max-w-lg mx-auto w-full flex flex-col overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-900">My Cart</h2>
        </div>
        <CartPanelContent className="flex-1 min-h-0" />
      </main>
    </div>
  );
}
