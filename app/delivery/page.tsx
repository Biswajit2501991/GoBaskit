'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeMobile } from '@/utils/mobile';
import { logoutEverywhere } from '@/utils/logoutEverywhere';
import StaffSessionKeeper from '@/components/Admin/StaffSessionKeeper';

function DeliveryPortal() {
  const [sessionReady, setSessionReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [online, setOnline] = useState(false);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSession = useCallback(async () => {
    const res = await fetch('/api/delivery/session', { cache: 'no-store', credentials: 'same-origin' });
    if (res.status === 401 || res.status === 403) {
      setAuthed(false);
      setSessionReady(true);
      setOnline(false);
      setEnabled(false);
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (typeof data.error === 'string') setError(data.error);
      }
      return false;
    }
    if (!res.ok) {
      setSessionReady(true);
      return false;
    }
    const data = (await res.json().catch(() => ({}))) as {
      enabled?: boolean;
      online?: boolean;
      name?: string;
    };
    setEnabled(data.enabled === true);
    setOnline(data.online === true);
    setName(typeof data.name === 'string' ? data.name : '');
    setAuthed(true);
    setSessionReady(true);
    setError('');
    return true;
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

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
      if (data.staff?.shopId) {
        setError('This login is for a shop. Use /shop instead.');
        return;
      }
      if (data.staff?.role !== 'DELIVERY_PARTNER') {
        setError('This login is for staff. Use /admin instead.');
        return;
      }
      const ok = await loadSession();
      if (!ok) setError((prev) => prev || 'Could not open delivery. Try again.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleOnline(next: boolean) {
    if (!enabled && next) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/delivery/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not update Start Delivery');
        await loadSession();
        return;
      }
      setEnabled(data.enabled === true);
      setOnline(data.online === true);
    } finally {
      setSaving(false);
    }
  }

  if (!sessionReady) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <h1 className="text-xl font-bold text-center mb-2">Delivery login</h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            Part-time partners sign in here, then turn on Start Delivery.
          </p>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || mobile.length < 10 || !password}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StaffSessionKeeper logoutRedirect="/delivery" />
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between gap-3">
        <p className="font-extrabold">
          Go<span className="text-blinkit-green">Baskit</span> Delivery
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
        <p className="text-sm text-gray-600">Hi {name || 'partner'}.</p>
        <div className="bg-white border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">Start Delivery</p>
              <p className="text-sm text-gray-500">
                {enabled
                  ? online
                    ? 'You are on shift. Pickup jobs will appear here next.'
                    : 'Turn this on when you are ready to take pickups.'
                  : 'Admin has not turned on partner delivery yet. No jobs or alerts while this is off.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={online}
              disabled={saving || !enabled}
              onClick={() => void toggleOnline(!online)}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
                online ? 'bg-blinkit-green' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  online ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </main>
    </div>
  );
}

export default function DeliveryPage() {
  return <DeliveryPortal />;
}
