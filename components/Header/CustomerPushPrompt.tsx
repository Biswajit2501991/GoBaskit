'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  canUseWebPush,
  isAppleMobileBrowser,
  isStandaloneDisplay,
} from '@/lib/admin-push-client';
import {
  enableCustomerPushAlerts,
  hasCustomerPushEnabled,
  peekCustomerPushPromptSkipped,
  skipCustomerPushPromptThisSession,
} from '@/lib/customer-push-client';

export default function CustomerPushPrompt({
  enabled,
}: {
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }
    if (typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/admin')) return;
    if (peekCustomerPushPromptSkipped()) return;
    if ('Notification' in window && Notification.permission === 'denied') return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const already = await hasCustomerPushEnabled();
        if (cancelled || already) return;
        setIosHint(isAppleMobileBrowser() && !isStandaloneDisplay());
        setOpen(true);
      })();
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled]);

  if (!open) return null;

  async function onEnable() {
    setBusy(true);
    setError('');
    const result = await enableCustomerPushAlerts();
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      return;
    }
    setError(result.error || 'Could not enable alerts');
  }

  function onNotNow() {
    skipCustomerPushPromptThisSession();
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 relative">
        <button
          type="button"
          onClick={onNotNow}
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 p-1"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="rounded-full bg-amber-100 p-2 shrink-0">
            <Bell className="w-5 h-5 text-amber-800" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Get out-for-delivery alerts</h2>
            <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
              Enable push notifications so you know when your order is out for delivery. We never include staff or rider names.
            </p>
            {iosHint && (
              <p className="text-sm text-amber-800 mt-2 leading-relaxed">
                On iPhone, add GoBaskit to the Home Screen first (Share → Add to Home Screen), open it from the icon, then tap Enable.
              </p>
            )}
            {!canUseWebPush() && !iosHint && (
              <p className="text-sm text-amber-800 mt-2">This browser does not support push notifications.</p>
            )}
          </div>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <div className="mt-4 space-y-2">
          <Button
            type="button"
            className="w-full h-11 rounded-xl font-semibold"
            disabled={busy}
            onClick={() => void onEnable()}
          >
            {busy ? 'Enabling…' : 'Enable notifications'}
          </Button>
          <Button type="button" variant="ghost" className="w-full text-gray-500" disabled={busy} onClick={onNotNow}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
