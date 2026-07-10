'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { usePathname } from 'next/navigation';
import CartPanelContent from '@/components/Cart/CartPanelContent';
import { useCartStore } from '@/store/cartStore';
import { useCartUiStore } from '@/store/cartUiStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * Blinkit-style right cart drawer with dimmed backdrop.
 * Items scroll; bill + checkout stay fixed at the bottom.
 */
export default function CartDrawer() {
  const pathname = usePathname();
  const hydrated = useCartHydrated();
  const isOpen = useCartUiStore((s) => s.isOpen);
  const closeCart = useCartUiStore((s) => s.closeCart);
  const itemCount = useCartStore((s) => s.getItemCount());
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  // Close when navigating to cart/checkout full pages to avoid double UI.
  useEffect(() => {
    if (pathname === '/cart' || pathname === '/checkout' || pathname?.startsWith('/checkout')) {
      closeCart();
    }
  }, [pathname, closeCart]);

  useEffect(() => {
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      if (isOpen) {
        setMounted(true);
        requestAnimationFrame(() => setEntered(true));
      } else {
        setEntered(false);
        exitTimer = setTimeout(() => setMounted(false), 220);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, closeCart]);

  if (!mounted || !portalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className={`absolute inset-0 bg-black/55 transition-opacity duration-200 ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="My Cart"
        className={`relative h-svh max-h-svh w-full max-w-md bg-[#f4f6fb] shadow-2xl flex flex-col
          transition-transform duration-300 ease-out
          ${entered ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={closeCart}
              className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-100"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="font-bold text-base text-gray-900 leading-tight">My Cart</h2>
              {hydrated && itemCount > 0 ? (
                <p className="text-[11px] text-gray-500">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </p>
              ) : null}
            </div>
          </div>
          <Link
            href="/cart"
            onClick={closeCart}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blinkit-green hover:underline shrink-0"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Full page
          </Link>
        </header>

        {!hydrated ? (
          <div className="flex-1 p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 skeleton rounded-xl" />
            ))}
          </div>
        ) : itemCount === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-20 h-20 bg-blinkit-green-light rounded-full flex items-center justify-center mb-4 text-3xl">
              🛒
            </div>
            <h3 className="text-lg font-bold mb-1">Your cart is empty</h3>
            <p className="text-sm text-gray-500 mb-5">Add groceries to get started</p>
            <Button type="button" onClick={closeCart}>
              Start Shopping
            </Button>
          </div>
        ) : (
          <CartPanelContent
            onContinueShopping={closeCart}
            onBeforeCheckout={closeCart}
          />
        )}
      </aside>
    </div>,
    portalRoot,
  );
}
