'use client';

import Link from 'next/link';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import CartPanelContent from '@/components/Cart/CartPanelContent';
import CartLoginGate from '@/components/Cart/CartLoginGate';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { Button } from '@/components/ui/button';

export default function CartPage() {
  const hydrated = useCartHydrated();
  const itemCount = useCartStore((s) => s.getItemCount());

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

  // Guests always see Login to Proceed on cart open; logged-in users get empty or full cart.
  return (
    <div
      className={
        itemCount === 0
          ? 'min-h-dvh flex flex-col bg-gray-50 overflow-x-hidden'
          : 'h-dvh max-h-dvh flex flex-col overflow-hidden bg-[#f4f6fb]'
      }
    >
      <Header showSearch={false} />
      <main
        className={
          itemCount === 0
            ? 'flex-1 max-w-lg mx-auto w-full flex flex-col'
            : 'flex-1 min-h-0 max-w-lg mx-auto w-full flex flex-col overflow-hidden'
        }
      >
        {itemCount > 0 ? (
          <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-bold text-gray-900">My Cart</h2>
          </div>
        ) : null}
        <CartLoginGate
          secondaryAction={
            <Button type="button" variant="secondary" asChild className="w-full sm:w-auto">
              <Link href="/">Continue Shopping</Link>
            </Button>
          }
        >
          {itemCount === 0 ? (
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
          ) : (
            <CartPanelContent className="flex-1 min-h-0" />
          )}
        </CartLoginGate>
      </main>
      {itemCount === 0 ? <Footer /> : null}
    </div>
  );
}
