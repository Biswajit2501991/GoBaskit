'use client';

import Link from 'next/link';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import CartPanelContent from '@/components/Cart/CartPanelContent';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { Button } from '@/components/ui/button';

export default function CartPage() {
  const hydrated = useCartHydrated();
  const itemCount = useCartStore((s) => s.getItemCount());

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
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

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6fb]">
      <Header />
      <main className="flex-1 max-w-lg mx-auto w-full flex flex-col min-h-0 h-[calc(100svh-4.5rem)] max-h-[calc(100svh-4.5rem)]">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold">My Cart</h2>
        </div>
        <CartPanelContent className="flex-1 min-h-0" />
      </main>
    </div>
  );
}
