'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_STOREFRONT_RATING,
  STOREFRONT_RATING_PER_REVIEW,
  formatStorefrontScore,
  parseStorefrontRating,
  storefrontDisplayCount,
  type StorefrontRatingPublic,
} from '@/lib/storefrontRating';

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
  const [enabled, setEnabled] = useState(DEFAULT_STOREFRONT_RATING.enabled);
  const [score, setScore] = useState(DEFAULT_STOREFRONT_RATING.score);
  const [seedCount, setSeedCount] = useState(DEFAULT_STOREFRONT_RATING.seedCount);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const pageSize = 20;

  function applyRating(row: StorefrontRatingPublic | undefined, nextRated?: number) {
    const parsed = parseStorefrontRating(row);
    setEnabled(parsed.enabled);
    setScore(parsed.score);
    setSeedCount(parsed.seedCount);
    if (typeof nextRated === 'number') setRatedCount(nextRated);
  }

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
        applyRating(data.storefrontRating, Number(data.ratedCount ?? 0));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, starsFilter]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const previewCount = storefrontDisplayCount(seedCount, ratedCount);

  async function saveDisplay() {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, score, seedCount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not save');
      }
      applyRating(data.storefrontRating, Number(data.ratedCount ?? ratedCount));
      setSaveMessage('Website rating updated.');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

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

      <section className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-sm text-gray-900">Website rating next to GoBaskit</h2>
          <p className="text-xs text-gray-500 mt-1">
            You set the score. Public count is seed + {STOREFRONT_RATING_PER_REVIEW} for each real star
            rating (skips do not count).
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Show rating on the website
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Score (out of 5)</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScore((s) => Math.max(1, Math.round((s - 0.1) * 10) / 10))}
              >
                −
              </Button>
              <input
                type="number"
                min={1}
                max={5}
                step={0.1}
                value={score}
                onChange={(e) => setScore(Number(e.target.value) || DEFAULT_STOREFRONT_RATING.score)}
                className="w-24 border rounded-lg px-3 py-2 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScore((s) => Math.min(5, Math.round((s + 0.1) * 10) / 10))}
              >
                +
              </Button>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Count seed</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSeedCount((n) => Math.max(0, n - STOREFRONT_RATING_PER_REVIEW))}
              >
                −10
              </Button>
              <input
                type="number"
                min={0}
                max={1000000}
                step={1}
                value={seedCount}
                onChange={(e) => setSeedCount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                className="w-28 border rounded-lg px-3 py-2 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSeedCount((n) => Math.min(1_000_000, n + STOREFRONT_RATING_PER_REVIEW))}
              >
                +10
              </Button>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          Preview:{' '}
          <span className="font-semibold">
            {formatStorefrontScore(score)} out of 5 · {previewCount}+ Customer Rating
          </span>
          <span className="text-gray-500">
            {' '}
            ({ratedCount} real rating{ratedCount === 1 ? '' : 's'} × {STOREFRONT_RATING_PER_REVIEW})
          </span>
        </p>
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => void saveDisplay()} disabled={saving}>
            {saving ? 'Saving…' : 'Save website rating'}
          </Button>
          {saveMessage && <span className="text-sm text-gray-600">{saveMessage}</span>}
        </div>
      </section>

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
