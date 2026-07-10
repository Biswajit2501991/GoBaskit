'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatter';
import { resolvePublicImageUrl } from '@/utils/image';
import { WISHLIST_MAX_ITEMS } from '@/constants';
import { useWishlistStore } from '@/store/wishlistStore';

type WishlistRow = {
  id: string;
  productId: string;
  variantId: string | null;
  label: string;
  price: number;
  imageUrl: string | null;
  unit: string;
  inStock: boolean;
};

export default function AccountWishlistSection() {
  const [items, setItems] = useState<WishlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const loadKeys = useWishlistStore((s) => s.load);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/customer/wishlist');
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      await loadKeys();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function remove(id: string) {
    const res = await fetch(`/api/customer/wishlist?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      await loadKeys();
    }
  }

  return (
    <section id="wishlist" className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 scroll-mt-24">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          Wishlist
        </h2>
        <span className="text-[11px] text-gray-400">
          {items.length}/{WISHLIST_MAX_ITEMS}
        </span>
      </div>
      <p className="text-xs text-gray-500">
        Save up to {WISHLIST_MAX_ITEMS} items. We&apos;ll notify you when out-of-stock picks are back after you log in.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading wishlist...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No saved items yet. Tap the heart on any product to add it.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((item) => (
            <li key={item.id} className="py-3 flex gap-3 items-center">
              <Link
                href={`/product/${item.productId}`}
                className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-yellow-50 to-green-50 border border-gray-100 shrink-0"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolvePublicImageUrl(item.imageUrl)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-blinkit-green">
                    {item.label.charAt(0)}
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/product/${item.productId}`} className="text-sm font-semibold text-gray-900 truncate block hover:text-blinkit-green">
                  {item.label}
                </Link>
                <p className="text-xs text-gray-400">{item.unit}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold">{formatCurrency(item.price)}</span>
                  {item.inStock ? (
                    <span className="text-[10px] font-bold uppercase text-blinkit-green">In stock</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-amber-700">Out of stock · Coming soon</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {item.inStock ? (
                  <Button asChild size="sm" className="h-7 text-[11px] px-2">
                    <Link href={`/product/${item.productId}`}>Order</Link>
                  </Button>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="inline-flex items-center justify-center text-gray-400 hover:text-red-500 p-1"
                  aria-label="Remove from wishlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
