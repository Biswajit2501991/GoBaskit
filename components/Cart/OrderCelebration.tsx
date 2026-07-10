'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Check } from 'lucide-react';

const CELEBRATE_KEY = 'gobaskit_celebrate_order';
const ORDER_NUMBER_KEY = 'gobaskit_last_order_number';

export function markOrderCelebration(orderNumber?: string) {
  try {
    sessionStorage.setItem(CELEBRATE_KEY, '1');
    if (orderNumber) sessionStorage.setItem(ORDER_NUMBER_KEY, orderNumber);
  } catch {
    /* ignore */
  }
}

/**
 * Full-screen celebration after a successful order, then soft-dismisses.
 * Mounted from Header so it works after router.push('/') without a hard refresh.
 */
export default function OrderCelebration() {
  const [visible, setVisible] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
    try {
      if (sessionStorage.getItem(CELEBRATE_KEY) === '1') {
        setVisible(true);
        setOrderNumber(sessionStorage.getItem(ORDER_NUMBER_KEY));
        sessionStorage.removeItem(CELEBRATE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(t);
  }, [visible]);

  if (!visible || !portalRoot) return null;

  const pieces = Array.from({ length: 48 }, (_, i) => i);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-black/35 pointer-events-auto" onClick={() => setVisible(false)} />

      <div className="celebration-burst absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {pieces.map((i) => (
          <span
            key={i}
            className="celebration-piece"
            style={
              {
                '--i': i,
                '--x': `${(i % 12) * 8.5 - 4}%`,
                '--delay': `${(i % 10) * 0.04}s`,
                '--hue': `${(i * 37) % 360}`,
                '--rot': `${(i * 47) % 360}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative z-10 pointer-events-auto mx-4 max-w-sm w-full rounded-2xl bg-white shadow-2xl border border-gray-100 p-6 text-center animate-[celebration-pop_0.45s_ease-out]">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blinkit-green-light text-blinkit-green">
          <Check className="h-7 w-7" strokeWidth={3} />
        </div>
        <h2 className="text-xl font-extrabold text-gray-900">Order placed!</h2>
        {orderNumber ? (
          <p className="mt-1 text-sm font-semibold text-blinkit-green">#{orderNumber}</p>
        ) : null}
        <p className="mt-2 text-sm text-gray-500">
          We&apos;re on it — delivery in about 15 minutes. Taking you home to keep shopping…
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/account"
            onClick={() => setVisible(false)}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Track my order
          </Link>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="inline-flex items-center justify-center rounded-xl bg-blinkit-green px-4 py-2.5 text-sm font-bold text-white hover:bg-blinkit-green-dark"
          >
            Continue shopping
          </button>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
