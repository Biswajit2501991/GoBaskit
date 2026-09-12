'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { markAndroidAlertsPromptAfterLogin } from '@/lib/admin-push-client';
import { normalizeMobile } from '@/utils/mobile';
import { logoutEverywhere } from '@/utils/logoutEverywhere';
import { formatCurrency, formatDateTime } from '@/utils/formatter';

type HistoryRow = {
  id: string;
  ticket: string;
  orderNumber: string;
  costToGobaskit: number;
  acceptedAt: string;
  pickupAt: string;
  items: Array<{ name: string; quantity: number; unit: string }>;
};

type Offer = {
  offerId: string;
  orderNumber: string;
  expiresAt: string;
  pickupHint: string | null;
  customer: {
    firstName: string;
    lastName: string;
    mobile: string;
    houseNumber: string;
    street: string;
    area: string;
    city: string;
    pincode: string;
  };
  items: Array<{ id: string; name: string; quantity: number; unit: string }>;
};

export default function ShopPortalPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const loadSeq = useRef(0);
  const [active, setActive] = useState<Offer | null>(null);
  const [viewedHistory, setViewedHistory] = useState<HistoryRow | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pickupAt, setPickupAt] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  const loadOffers = useCallback(async () => {
    const seq = ++loadSeq.current;
    const res = await fetch('/api/shop/offers', { cache: 'no-store', credentials: 'same-origin' });
    if (seq !== loadSeq.current) return false;
    if (res.status === 401) {
      setAuthed(false);
      setSessionReady(true);
      return false;
    }
    if (!res.ok) {
      const fail = await res.json().catch(() => ({}));
      setSessionReady(true);
      if (typeof fail.error === 'string') setError(fail.error);
      return false;
    }
    const data = await res.json().catch(() => ({}));
    if (seq !== loadSeq.current) return false;
    const next = Array.isArray(data.offers) ? (data.offers as Offer[]) : [];
    const past = Array.isArray(data.history) ? (data.history as HistoryRow[]) : [];
    setOffers(next);
    setHistory(past);
    setError('');
    setAuthed(true);
    setSessionReady(true);
    setActive((current) => {
      if (current && next.some((offer) => offer.offerId === current.offerId)) return current;
      return next[0] ?? null;
    });
    return true;
  }, []);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  useEffect(() => {
    if (!authed) return;
    const source = new EventSource('/api/shop/events');
    source.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data) as { type?: string };
        if (event.type === 'notification_created' || event.type === 'order_updated') {
          void loadOffers();
        }
        if (event.type === 'notification_created') {
          try {
            const Ctx =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (Ctx) {
              const ctx = new Ctx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.frequency.value = 880;
              gain.gain.value = 0.05;
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.18);
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    };
    const poll = setInterval(() => void loadOffers(), 15000);
    return () => {
      source.close();
      clearInterval(poll);
    };
  }, [authed, loadOffers]);

  useEffect(() => {
    if (!active) {
      setSelected({});
      return;
    }
    setSelected(Object.fromEntries(active.items.map((item) => [item.id, true])));
    const next = new Date(Date.now() + 60 * 60 * 1000);
    next.setMinutes(0, 0, 0);
    const local = new Date(next.getTime() - next.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setPickupAt(local);
  }, [active?.offerId]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: normalizeMobile(mobile), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      if (!data.staff?.shopId) {
        setError('This login is for staff. Use /admin instead.');
        return;
      }
      markAndroidAlertsPromptAfterLogin();
      const opened = await loadOffers();
      if (!opened) {
        setError((prev) => prev || 'Could not open the shop portal. Try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    if (!active) return;
    const itemIds = active.items.filter((item) => selected[item.id]).map((item) => item.id);
    setBusy(true);
    setInfo('');
    try {
      const res = await fetch(`/api/shop/offers/${active.offerId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds,
          pickupAt: new Date(pickupAt).toISOString(),
          costToGobaskit: Number(cost),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInfo(typeof data.error === 'string' ? data.error : 'Could not accept');
        await loadOffers();
        return;
      }
      setInfo(`Accepted as ${data.ticket}`);
      setActive(null);
      await loadOffers();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!active) return;
    setBusy(true);
    try {
      await fetch(`/api/shop/offers/${active.offerId}/reject`, { method: 'POST' });
      setActive(null);
      await loadOffers();
    } finally {
      setBusy(false);
    }
  }

  if (!sessionReady) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <h1 className="text-xl font-bold text-center mb-6">Shop login</h1>
          <form onSubmit={onLogin} className="space-y-4">
            <div>
              <Label>Mobile Number</Label>
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(-10))}
                inputMode="numeric"
                maxLength={10}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 my-auto text-gray-400"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || mobile.length < 10 || !password}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between gap-3">
        <p className="font-extrabold">
          Go<span className="text-blinkit-green">Baskit</span> Shop
        </p>
        <button
          type="button"
          onClick={() => {
            void logoutEverywhere('/');
          }}
          className="text-sm font-medium text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          Logout
        </button>
      </header>
      <main className="max-w-lg mx-auto p-4 space-y-4">
        {info && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3">{info}</p>}
        {!offers.length && (
          <p className="text-sm text-gray-500">No open pickups. New orders will pop up here with sound.</p>
        )}
        {offers.map((offer) => (
          <button
            key={offer.offerId}
            type="button"
            className="w-full text-left bg-white border rounded-2xl p-4"
            onClick={() => setActive(offer)}
          >
            <p className="font-bold">{offer.orderNumber}</p>
            <p className="text-sm text-gray-600">
              {offer.items.map((item) => `${item.quantity} ${item.unit} ${item.name}`).join(', ')}
            </p>
          </button>
        ))}

        <section className="pt-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Accepted last 30 days</h2>
          <p className="text-xs text-gray-500">Tap an order to see items. Cost and ticket cannot be changed.</p>
          {!history.length && (
            <p className="text-sm text-gray-500">No accepted pickups in the last 30 days.</p>
          )}
          {history.map((row) => (
            <button
              key={row.id || row.ticket}
              type="button"
              className="w-full text-left bg-white border rounded-2xl p-4"
              onClick={() => {
                setActive(null);
                setViewedHistory(row);
              }}
            >
              <p className="font-bold">{row.ticket}</p>
              <p className="text-sm text-gray-600">Cost {formatCurrency(row.costToGobaskit)}</p>
              <p className="text-xs text-gray-400 mt-1">{formatDateTime(row.acceptedAt)}</p>
            </button>
          ))}
        </section>
      </main>

      {active && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 space-y-4">
            <h2 className="text-lg font-bold">New pickup · {active.orderNumber}</h2>
            <p className="text-sm text-gray-600">
              {active.customer.firstName} {active.customer.lastName} · +91 {active.customer.mobile}
              <br />
              {active.customer.houseNumber}, {active.customer.street}, {active.customer.area},{' '}
              {active.customer.city} {active.customer.pincode}
            </p>
            {active.pickupHint && (
              <p className="text-sm font-semibold text-amber-800">
                Pick up by {new Date(active.pickupHint).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <div className="space-y-2">
              {active.items.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected[item.id] === true}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                  />
                  {item.quantity} {item.unit} {item.name}
                </label>
              ))}
            </div>
            <div>
              <Label>Pickup time</Label>
              <Input type="datetime-local" className="mt-1" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} />
            </div>
            <div>
              <Label>Amount GoBaskit should pay (₹)</Label>
              <Input
                type="number"
                min="0"
                className="mt-1"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={busy} onClick={() => void accept()}>
              {busy ? 'Saving…' : 'Accept'}
            </Button>
            <Button variant="ghost" className="w-full" disabled={busy} onClick={() => void reject()}>
              Reject
            </Button>
          </div>
        </div>
      )}

      {viewedHistory && (
        <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 space-y-4">
            <h2 className="text-lg font-bold">Accepted · {viewedHistory.ticket}</h2>
            <p className="text-sm text-gray-600">Cost {formatCurrency(viewedHistory.costToGobaskit)}</p>
            <p className="text-xs text-gray-400">{formatDateTime(viewedHistory.acceptedAt)}</p>
            <ul className="space-y-2">
              {(viewedHistory.items ?? []).map((item, index) => (
                <li key={`${item.name}-${index}`} className="text-sm text-gray-800">
                  {item.quantity} {item.unit} {item.name}
                </li>
              ))}
              {!(viewedHistory.items ?? []).length && (
                <li className="text-sm text-gray-500">No item lines on this pickup.</li>
              )}
            </ul>
            <p className="text-xs text-gray-400">This pickup is locked. Nothing can be edited.</p>
            <Button variant="ghost" className="w-full" onClick={() => setViewedHistory(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
