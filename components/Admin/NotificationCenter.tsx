'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Volume2, X } from 'lucide-react';
import { subscribeToAdminEvents } from '@/lib/realtime/adminEventsClient';
import {
  canUseWebPush,
  enableAdminPushAlerts,
  isAppleMobileBrowser,
  isStandaloneDisplay,
  registerAdminServiceWorker,
} from '@/lib/admin-push-client';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

const SOUND_UNLOCK_KEY = 'gobaskit_admin_sound_unlocked';

export function NotificationCenter({ staffId }: { staffId: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const [readState, setReadState] = useState<'all' | 'read' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [showSoundHint, setShowSoundHint] = useState(false);
  const [pushStatus, setPushStatus] = useState<'unknown' | 'off' | 'on' | 'unsupported'>('unknown');
  const [isAppleMobile, setIsAppleMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundAtRef = useRef(0);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((c) => {
        if (typeof c.notificationSoundEnabled === 'boolean') {
          setSoundEnabled(c.notificationSoundEnabled);
        }
      })
      .catch(() => {
        /* keep default */
      });

    try {
      if (sessionStorage.getItem(SOUND_UNLOCK_KEY) === '1') {
        setSoundUnlocked(true);
      } else {
        setShowSoundHint(true);
      }
    } catch {
      setShowSoundHint(true);
    }

    const apple = isAppleMobileBrowser();
    const standalone = isStandaloneDisplay();
    setIsAppleMobile(apple);
    setIsStandalone(standalone);

    // Register SW early when supported; subscription still needs an explicit Enable tap.
    if (canUseWebPush()) {
      void registerAdminServiceWorker();
      if (Notification.permission === 'granted') {
        setPushStatus('on');
      } else {
        setPushStatus('off');
      }
    } else {
      setPushStatus('unsupported');
    }
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ pageSize: '20', readState });
    if (typeFilter) params.set('type', typeFilter);
    const res = await fetch(`/api/admin/notifications?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    }
  }, [readState, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void load();
    }, 12_000);
    return () => clearInterval(timer);
  }, [load]);

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }, []);

  const playBeep = useCallback(async () => {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    if (ctx.state !== 'running') return false;

    const now = ctx.currentTime;
    // Two short tones — clear on phone speakers
    const tones = [
      { freq: 880, start: 0, dur: 0.12 },
      { freq: 1175, start: 0.14, dur: 0.16 },
    ];
    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = tone.freq;
      gain.gain.setValueAtTime(0.0001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(0.35, now + tone.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur + 0.02);
    }
    return true;
  }, [getAudioContext]);

  const unlockSound = useCallback(async () => {
    const ok = await playBeep();
    if (ok) {
      setSoundUnlocked(true);
      setShowSoundHint(false);
      try {
        sessionStorage.setItem(SOUND_UNLOCK_KEY, '1');
      } catch {
        /* private mode */
      }
      setStatusMessage('Sound enabled. Keep this admin tab open to hear new orders.');
    } else {
      setStatusMessage('Could not unlock sound. Tap again, and check the phone is not on silent.');
    }
    return ok;
  }, [playBeep]);

  const enableBackgroundAlerts = useCallback(async () => {
    setPushBusy(true);
    setStatusMessage('');
    try {
      // Always unlock in-tab sound first (works on iPhone Safari even without push).
      await unlockSound();

      if (!canUseWebPush()) {
        if (isAppleMobile && !isStandalone) {
          setStatusMessage(
            'Sound is on for this tab. For popup alerts when Safari is minimized: Share → Add to Home Screen, open GoBaskit from the home icon, then tap Enable Alerts again.',
          );
        } else {
          setStatusMessage('Sound is on. Keep the admin tab open — this browser cannot show background popups.');
        }
        setShowSoundHint(false);
        return;
      }

      const result = await enableAdminPushAlerts();
      if (result.ok) {
        setPushStatus('on');
        setStatusMessage('Background alerts enabled. You can minimize and still get new-order popups with sound.');
        setShowSoundHint(false);
      } else {
        setPushStatus('off');
        setStatusMessage(result.error || 'Could not enable background alerts. Sound may still work with the tab open.');
      }
    } finally {
      setPushBusy(false);
    }
  }, [unlockSound, isAppleMobile, isStandalone]);

  const playNotificationSound = useCallback(async () => {
    if (!soundEnabled) return;
    const now = Date.now();
    if (now - lastSoundAtRef.current < 400) return;
    lastSoundAtRef.current = now;

    const played = await playBeep();
    if (!played) {
      setShowSoundHint(true);
      setSoundUnlocked(false);
    }

    // Haptic feedback on phones (works even when audio is blocked)
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([120, 60, 120]);
      }
    } catch {
      /* ignore */
    }
  }, [soundEnabled, playBeep]);

  useEffect(() => {
    const unsubscribe = subscribeToAdminEvents((data) => {
      if (data.type !== 'notification_created') return;
      const payload = data.payload as Record<string, unknown>;
      const targetStaffId = payload.staffId ? String(payload.staffId) : null;
      if (targetStaffId && targetStaffId !== staffId) return;

      const n: NotificationItem = {
        id: String(payload.id ?? ''),
        type: String(payload.type ?? ''),
        title: String(payload.title ?? ''),
        message: String(payload.message ?? ''),
        entityType: payload.entityType ? String(payload.entityType) : null,
        entityId: payload.entityId ? String(payload.entityId) : null,
        readAt: null,
        createdAt: String(payload.createdAt ?? new Date().toISOString()),
      };
      setUnreadCount((c) => c + 1);
      setItems((prev) => [{ ...n, readAt: null }, ...prev].slice(0, 10));
      setToast(n);
      setTimeout(() => setToast(null), 5000);

      void playNotificationSound();

      // System notification when tab is in background / minimized (if permission granted).
      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(n.title, {
            body: n.message,
            tag: `order-${n.entityId || n.id}`,
            requireInteraction: true,
          });
        } catch {
          /* ignore */
        }
      }
    });
    return unsubscribe;
  }, [staffId, playNotificationSound]);

  async function markRead(id: string) {
    await fetch(`/api/admin/notifications/${id}/read`, { method: 'POST' });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  async function clearAllNotifications() {
    if (items.length === 0 && unreadCount === 0) return;
    const ok = window.confirm('Clear all notifications? This cannot be undone.');
    if (!ok) return;
    const res = await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearAll: true }),
    });
    if (res.ok) {
      setItems([]);
      setUnreadCount(0);
    }
  }

  async function markTypeRead() {
    if (!typeFilter) return;
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markTypeRead: typeFilter }),
    });
    await load();
  }

  async function onBellClick() {
    // First tap unlocks mobile audio (required by iOS/Android browsers).
    if (soundEnabled && !soundUnlocked) {
      await unlockSound();
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => void onBellClick()}
          className="relative p-2 rounded-lg hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-white border rounded-xl shadow-lg z-50">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="font-semibold text-sm">Notifications</span>
              <button type="button" onClick={load} className="text-xs text-gray-500 hover:underline">
                Refresh
              </button>
            </div>
            {soundEnabled && (
              <div className="px-3 py-2 border-b bg-amber-50 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] text-amber-900 leading-snug">
                    {pushStatus === 'on'
                      ? 'Background alerts are on — new orders can popup with sound even if the browser is minimized.'
                      : pushStatus === 'unsupported' && isAppleMobile && !isStandalone
                        ? 'On iPhone Safari, tap Enable Sound for this tab. For popups when minimized: Share → Add to Home Screen, then open from the home icon.'
                        : pushStatus === 'unsupported'
                          ? 'Tap Enable Sound for this tab. Keep the admin page open to hear new orders.'
                          : 'Enable once for popup + sound when the browser is minimized. Sound also works with this tab open.'}
                  </p>
                  <button
                    type="button"
                    disabled={pushBusy}
                    onClick={() => void enableBackgroundAlerts()}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-blinkit-green px-2.5 py-1.5 rounded-lg disabled:opacity-60"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    {pushBusy
                      ? 'Enabling…'
                      : pushStatus === 'on'
                        ? 'Re-enable'
                        : pushStatus === 'unsupported'
                          ? 'Enable Sound'
                          : 'Enable Alerts'}
                  </button>
                </div>
                {statusMessage && <p className="text-[11px] text-amber-800">{statusMessage}</p>}
                {soundUnlocked && pushStatus !== 'on' && (
                  <p className="text-[11px] text-green-800">Sound unlocked for this session.</p>
                )}
              </div>
            )}
            <div className="p-2 border-b bg-gray-50 space-y-2">
              <div className="flex gap-2">
                <select
                  value={readState}
                  onChange={(e) => setReadState(e.target.value as 'all' | 'read' | 'unread')}
                  className="text-xs border rounded px-2 py-1 flex-1"
                >
                  <option value="all">All</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-xs border rounded px-2 py-1 flex-1"
                >
                  <option value="">All types</option>
                  <option value="new_order">New Order</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div className="flex justify-between gap-2 flex-wrap">
                {unreadCount > 0 ? (
                  <button type="button" onClick={markAllRead} className="text-xs text-blinkit-green hover:underline">
                    Mark all read
                  </button>
                ) : <span />}
                <div className="flex gap-3 ml-auto">
                  {typeFilter && (
                    <button type="button" onClick={markTypeRead} className="text-xs text-blinkit-green hover:underline">
                      Mark {typeFilter} read
                    </button>
                  )}
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void clearAllNotifications()}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {items.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 text-center">No notifications</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => { if (!n.readAt) markRead(n.id); }}
                    className={`w-full text-left p-3 border-b hover:bg-gray-50 ${!n.readAt ? 'bg-green-50/50' : ''}`}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{n.message}</p>
                    {n.entityType === 'orders' && n.entityId && (
                      <Link href="/admin/orders" className="text-xs text-blinkit-green mt-1 inline-block" onClick={() => setOpen(false)}>
                        View orders →
                      </Link>
                    )}
                    {n.entityType === 'products' && n.entityId && (
                      <Link href="/admin/products" className="text-xs text-blinkit-green mt-1 inline-block" onClick={() => setOpen(false)}>
                        Update stock →
                      </Link>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showSoundHint && soundEnabled && !soundUnlocked && (
        <div className="fixed bottom-20 left-4 right-4 z-[60] sm:left-auto sm:right-4 sm:max-w-sm bg-white border shadow-lg rounded-xl p-3 flex gap-3 items-center">
          <Volume2 className="w-5 h-5 text-blinkit-green shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Enable order sound</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {isAppleMobile && !isStandalone
                ? 'Tap Enable to hear new orders in this tab. For popups when Safari is minimized, add GoBaskit to your Home Screen.'
                : 'Tap Enable so new orders play a sound (and popup when supported).'}
            </p>
          </div>
          <button
            type="button"
            disabled={pushBusy}
            onClick={() => void enableBackgroundAlerts()}
            className="shrink-0 text-xs font-semibold text-white bg-blinkit-green px-3 py-2 rounded-lg disabled:opacity-60"
          >
            Enable
          </button>
          <button type="button" onClick={() => setShowSoundHint(false)} aria-label="Dismiss">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-[60] bg-white border shadow-lg rounded-xl p-4 max-w-sm flex gap-3">
          <Bell className="w-5 h-5 text-blinkit-green shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm">{toast.title}</p>
            <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-line">{toast.message}</p>
          </div>
          <button type="button" onClick={() => setToast(null)}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
      )}
    </>
  );
}
