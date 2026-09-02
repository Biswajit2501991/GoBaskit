'use client';

import {
  canUseWebPush,
  isAppleMobileBrowser,
  isStandaloneDisplay,
  registerAdminServiceWorker,
} from '@/lib/admin-push-client';

export const CUSTOMER_PUSH_SKIP_SESSION_KEY = 'gobaskit_customer_push_prompt_skip';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function skipCustomerPushPromptThisSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CUSTOMER_PUSH_SKIP_SESSION_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function peekCustomerPushPromptSkipped(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(CUSTOMER_PUSH_SKIP_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/** Next login should prompt again after Not now. */
export function clearCustomerPushPromptSkip(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CUSTOMER_PUSH_SKIP_SESSION_KEY);
  } catch {
    /* private mode */
  }
}

export async function hasCustomerPushEnabled(): Promise<boolean> {
  try {
    const res = await fetch('/api/customer/push/subscribe', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { subscribed?: boolean };
    return data.subscribed === true;
  } catch {
    return false;
  }
}

export async function enableCustomerPushAlerts(): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'Not in browser' };
  if (!canUseWebPush()) {
    if (isAppleMobileBrowser() && !isStandaloneDisplay()) {
      return {
        ok: false,
        error:
          'On iPhone, add GoBaskit to the Home Screen first. Share → Add to Home Screen, open the icon, then tap Enable.',
      };
    }
    return { ok: false, error: 'This browser does not support push notifications' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Notification permission denied. Enable it in your browser settings.' };
  }

  const cfgRes = await fetch('/api/customer/push/subscribe', { credentials: 'include', cache: 'no-store' });
  if (cfgRes.status === 401 || cfgRes.status === 403) {
    return { ok: false, error: 'Sign in again, then enable delivery alerts.' };
  }
  const cfg = cfgRes.ok ? await cfgRes.json() : null;
  if (!cfg?.configured || !cfg.publicKey) {
    return { ok: false, error: 'Push is not configured on the server yet' };
  }

  const reg = await registerAdminServiceWorker();
  if (!reg) return { ok: false, error: 'Could not register service worker' };
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as BufferSource,
    }));

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: 'Invalid push subscription' };
  }

  const save = await fetch('/api/customer/push/subscribe', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  });
  if (!save.ok) {
    const data = await save.json().catch(() => ({}));
    return { ok: false, error: typeof data.error === 'string' ? data.error : 'Failed to save subscription' };
  }

  return { ok: true };
}
