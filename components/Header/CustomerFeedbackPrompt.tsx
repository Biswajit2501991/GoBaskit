'use client';

import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { countFeedbackWords, ORDER_FEEDBACK_MAX_WORDS } from '@/lib/orderFeedback';

export default function CustomerFeedbackPrompt({
  enabled,
  onSettled,
}: {
  enabled: boolean;
  onSettled: () => void;
}) {
  const [order, setOrder] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    if (!enabled) {
      onSettled();
      return;
    }
    if (typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/admin')) {
      onSettled();
      return;
    }

    let cancelled = false;
    void fetch('/api/customer/feedback/pending', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          pending?: boolean;
          orderId?: string;
          orderNumber?: string;
        };
        if (cancelled) return;
        if (data.pending === true && data.orderId && data.orderNumber) {
          setOrder({ orderId: data.orderId, orderNumber: data.orderNumber });
          return;
        }
        onSettled();
      })
      .catch(() => {
        if (!cancelled) onSettled();
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, onSettled]);

  async function submit() {
    if (!order || stars < 1) {
      setError('Please select a star rating');
      return;
    }
    if (countFeedbackWords(note) > ORDER_FEEDBACK_MAX_WORDS) {
      setError(`Note must be ${ORDER_FEEDBACK_MAX_WORDS} words or fewer`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/customer/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.orderId,
          stars,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not save feedback');
        setBusy(false);
        return;
      }
      setThanks(true);
      window.setTimeout(() => {
        setOrder(null);
        onSettled();
      }, 2200);
    } catch {
      setError('Network error. Please try again.');
      setBusy(false);
    }
  }

  async function skip() {
    if (!order) {
      onSettled();
      return;
    }
    setBusy(true);
    try {
      await fetch('/api/customer/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.orderId, skipped: true }),
      });
    } catch {
      /* still close so push can show */
    }
    setOrder(null);
    onSettled();
  }

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 relative">
        {thanks ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-lg font-bold text-gray-900">Thank you</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Your feedback is valuable. Thank you for your feedback.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void skip()}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 p-1"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-gray-900 pr-8">How was your last order?</h2>
            <p className="text-sm text-gray-500 mt-1">Order {order.orderNumber}</p>
            <div className="flex justify-center gap-1.5 mt-4" role="group" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="p-1"
                  onClick={() => setStars(value)}
                  aria-label={`${value} star${value === 1 ? '' : 's'}`}
                >
                  <Star
                    className={`w-8 h-8 ${
                      value <= stars ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <label className="block mt-4">
              <span className="text-sm font-medium text-gray-700">Add a note (optional, 50 words)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="How was delivery and the items?"
              />
              <span className="text-xs text-gray-400 mt-1 block">
                {countFeedbackWords(note)} / {ORDER_FEEDBACK_MAX_WORDS} words
              </span>
            </label>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            <div className="mt-4 space-y-2">
              <Button
                type="button"
                className="w-full h-11 rounded-xl font-semibold"
                disabled={busy || stars < 1}
                onClick={() => void submit()}
              >
                {busy ? 'Sending…' : 'Submit feedback'}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-gray-500" disabled={busy} onClick={() => void skip()}>
                Not now
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
