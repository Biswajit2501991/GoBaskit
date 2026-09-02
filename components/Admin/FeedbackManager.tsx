'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface FeedbackRow {
  id: string;
  orderId: string;
  orderNumber: string;
  customerMobile: string;
  stars: number | null;
  note: string | null;
  createdAt: string;
}

export default function FeedbackManager() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [averageStars, setAverageStars] = useState<number | null>(null);
  const [ratedCount, setRatedCount] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [starsFilter, setStarsFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (starsFilter) params.set('stars', starsFilter);
    void fetch(`/api/admin/feedback?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok) return;
        setItems(data.items ?? []);
        setAverageStars(typeof data.averageStars === 'number' ? data.averageStars : null);
        setRatedCount(Number(data.ratedCount ?? 0));
        setTotal(Number(data.total ?? 0));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, starsFilter]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Customer Feedback</h1>
        <p className="text-sm text-gray-500 mt-1">
          All delivered-order ratings in one place. Overall:{' '}
          <span className="font-semibold text-gray-800">
            {averageStars == null ? 'No ratings yet' : `${averageStars} / 5 from ${ratedCount} reviews`}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={starsFilter}
          onChange={(e) => {
            setStarsFilter(e.target.value);
            setPage(1);
          }}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">All stars</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={String(n)}>
              {n} star{n === 1 ? '' : 's'}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Stars</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3">Mobile</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={5}>
                  No feedback yet.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/admin/orders?order=${row.orderId}`} className="text-blinkit-green">
                      {row.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.stars ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-md">{row.note || '—'}</td>
                  <td className="px-4 py-3 font-mono">{row.customerMobile}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-gray-500 self-center">
            Page {page} of {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
