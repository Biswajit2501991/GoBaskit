'use client';

import Link from 'next/link';
import { formatCurrency } from '@/utils/formatter';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';

export default function FloatingCartBar() {
  const hydrated = useCartHydrated();
  const itemCount = useCartStore((s) => s.getItemCount());
  const subtotal = useCartStore((s) => s.getSubtotal());

  if (!hydrated || itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-3 z-40">
      <Link
        href="/cart"
        className="max-w-lg mx-auto flex items-center justify-between bg-blinkit-green hover:bg-blinkit-green-dark text-white px-5 py-3.5 rounded-xl shadow-xl transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="bg-white/20 rounded-md px-2 py-0.5 font-bold text-sm">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
          <span className="font-semibold text-sm">View Cart</span>
        </div>
        <span className="font-bold">{formatCurrency(subtotal)}</span>
      </Link>
    </div>
  );
}
