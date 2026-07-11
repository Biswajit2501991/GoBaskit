'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { toE164 } from '@/utils/phone';
import { setSessionVerifiedMobile } from '@/utils/whatsappVerificationSession';
import { peekWarmCustomerSession } from '@/utils/warmCustomerSession';

const TOAST_KEY = 'gobaskit_account_verified_toast';
const SEEN_KEY = 'gobaskit_account_verified_seen';

/**
 * Shows “Account verified” when admin/webhook finishes WhatsApp verification.
 * Triggered by sessionStorage flag (set after verify poll) or by account poll.
 * Polls only while verification is still pending — skips forever-poll when already verified.
 */
export default function AccountVerifiedToast({
  enabled,
  mobile10,
}: {
  enabled: boolean;
  mobile10?: string | null;
}) {
  const [visible, setVisible] = useState(false);
  const wasVerified = useRef<boolean | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function showOnce() {
      try {
        if (sessionStorage.getItem(SEEN_KEY) === '1') return;
        sessionStorage.setItem(SEEN_KEY, '1');
        sessionStorage.removeItem(TOAST_KEY);
      } catch {
        /* ignore */
      }
      setVisible(true);
      window.setTimeout(() => setVisible(false), 8000);
    }

    try {
      if (sessionStorage.getItem(TOAST_KEY) === '1') {
        showOnce();
      }
    } catch {
      /* ignore */
    }

    if (!mobile10) return;

    const warm = peekWarmCustomerSession();
    if (warm?.isWhatsappVerified && warm.needsVerification !== true) {
      wasVerified.current = true;
      return;
    }

    let timer: number | undefined;

    const poll = async () => {
      try {
        const res = await fetch('/api/customer/account');
        if (!res.ok) return;
        const data = (await res.json()) as {
          isWhatsappVerified?: boolean;
          needsVerification?: boolean;
          mobile?: string;
        };
        const verified = data.isWhatsappVerified === true;
        if (wasVerified.current === false && verified) {
          const e164 = toE164('91', mobile10);
          if (e164) setSessionVerifiedMobile(e164);
          try {
            sessionStorage.setItem(TOAST_KEY, '1');
          } catch {
            /* ignore */
          }
          showOnce();
        }
        wasVerified.current = verified;
        // Stop polling once verified and no longer needed.
        if (verified && data.needsVerification !== true && timer) {
          window.clearInterval(timer);
          timer = undefined;
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    timer = window.setInterval(poll, 12_000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [enabled, mobile10]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[90] w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-xl border border-green-200 bg-white px-3 py-3 shadow-lg sm:bottom-6">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Account verified</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Your WhatsApp number is confirmed. You can track orders from My Account.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          onClick={() => setVisible(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
