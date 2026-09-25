'use client';

import { useEffect, useState } from 'react';
import { resolvePublicImageUrl } from '@/utils/image';
import { formatCurrency } from '@/utils/formatter';

type DemandRow = {
  productId: string;
  variantId: string | null;
  name: string;
  price: number;
  stock: number;
  unit: string;
  imageUrl: string | null;
  customers: number;
  waiting: number;
};

export default function WishlistDemandManager() {
  const [items, setItems] = useState<DemandRow[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalSaves, setTotalSaves] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void fetch('/api/admin/wishlist-demand', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setError(data?.error || 'Could not load wishlist demand');
          return;
        }
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotalProducts(Number(data.totalProducts) || 0);
        setTotalSaves(Number(data.totalSaves) || 0);
      })
      .catch(() => {
        if (alive) setError('Could not load wishlist demand');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Wishlist demand</h1>
        <p className="mt-1 text-sm text-gray-500">
          Products customers saved, from most wished to least. Counts are read-only and do not
          change wishlists, stock, or orders.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
          {totalProducts} product{totalProducts === 1 ? '' : 's'}
        </span>
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1">
          {totalSaves} customer save{totalSaves === 1 ? '' : 's'}
        </span>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-gray-500">No wishlisted products yet.</p>
      ) : null}

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Customers</th>
                <th className="px-3 py-2">Waiting</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Stock</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => {
                const src = row.imageUrl ? resolvePublicImageUrl(row.imageUrl) : '';
                return (
                  <tr key={`${row.productId}-${row.variantId || 'base'}`} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-400">{index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-100" />
                        )}
                        <span className="font-medium text-gray-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-900">{row.customers}</td>
                    <td className="px-3 py-2 text-gray-600">{row.waiting}</td>
                    <td className="px-3 py-2">{formatCurrency(row.price)}</td>
                    <td className="px-3 py-2">
                      {row.stock > 0 ? row.stock : 'Out'}
                      {row.unit ? <span className="text-gray-400"> {row.unit}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
