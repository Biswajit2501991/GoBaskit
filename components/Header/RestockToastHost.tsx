'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

type RestockNotice = {
  id: string;
  productId: string;
  variantId: string | null;
  title: string;
  message: string;
};

export default function RestockToastHost({ enabled }: { enabled: boolean }) {
  const [notices, setNotices] = useState<RestockNotice[]>([]);

  useEffect(() => {
    if (!enabled) {
      setNotices([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customer/restock-notices');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.notices)) {
          setNotices(data.notices);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  async function dismiss(ids?: string[]) {
    setNotices((prev) => (ids?.length ? prev.filter((n) => !ids.includes(n.id)) : []));
    try {
      await fetch('/api/customer/restock-notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch {
      /* ignore */
    }
  }

  if (!notices.length) return null;

  return (
    <div className="fixed bottom-20 right-3 z-[80] w-[min(100%-1.5rem,22rem)] space-y-2 pointer-events-none">
      {notices.slice(0, 3).map((notice) => (
        <div
          key={notice.id}
          className="pointer-events-auto rounded-xl border border-blinkit-green/30 bg-white shadow-lg p-3"
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{notice.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{notice.message}</p>
              <Link
                href={`/product/${notice.productId}`}
                className="inline-block mt-2 text-xs font-bold text-blinkit-green hover:underline"
                onClick={() => dismiss([notice.id])}
              >
                Order now →
              </Link>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss([notice.id])}
              className="text-gray-400 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      {notices.length > 1 ? (
        <button
          type="button"
          onClick={() => dismiss()}
          className="pointer-events-auto w-full text-[11px] font-semibold text-gray-500 hover:text-gray-800"
        >
          Dismiss all
        </button>
      ) : null}
    </div>
  );
}
