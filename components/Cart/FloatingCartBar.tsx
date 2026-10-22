'use client';

import { formatCurrency } from '@/utils/formatter';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { useCartUiStore } from '@/store/cartUiStore';

export default function FloatingCartBar() {
  const hydrated = useCartHydrated();
  const itemCount = useCartStore((s) => s.getItemCount());
  const subtotal = useCartStore((s) => s.getSubtotal());
  const openCart = useCartUiStore((s) => s.openCart);
  const isCartOpen = useCartUiStore((s) => s.isOpen);

  if (!hydrated || itemCount === 0 || isCartOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-mobile-chrome">
      <button
        type="button"
        onClick={openCart}
        className="w-full max-w-lg mx-auto flex items-center justify-between bg-forest hover:bg-forest-dark text-white px-4 py-3 rounded-full shadow-[0_12px_30px_-12px_rgba(20,48,40,0.7)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="bg-carrot text-white rounded-full px-2.5 py-0.5 font-bold text-xs">
            {itemCount}
          </span>
          <span className="font-semibold text-sm">View basket</span>
        </div>
        <span className="font-display font-semibold">{formatCurrency(subtotal)}</span>
      </button>
    </div>
  );
}
