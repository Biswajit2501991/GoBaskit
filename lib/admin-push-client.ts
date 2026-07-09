'use client';

/** Helpers for admin Web Push (background new-order alerts). */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** iPhone/iPad Safari only supports Web Push after Add to Home Screen (standalone). */
export function isAppleMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia('(display-mode: standalone)').matches;
}

export function canUseWebPush(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function registerAdminServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.error('[push] SW register failed', err);
    return null;
  }
}

export async function enableAdminPushAlerts(): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined') return { ok: false, error: 'Not in browser' };
  if (!canUseWebPush()) {
    if (isAppleMobileBrowser() && !isStandaloneDisplay()) {
      return {
        ok: false,
        error:
          'iPhone Safari needs Add to Home Screen for background popups. Share → Add to Home Screen, open from the home icon, then try again.',
      };
    }
    return { ok: false, error: 'This browser does not support push notifications' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Notification permission denied. Enable it in phone browser settings.' };
  }

  const cfgRes = await fetch('/api/admin/push/subscribe');
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

  const save = await fetch('/api/admin/push/subscribe', {
    method: 'POST',
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
