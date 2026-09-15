'use client';

import { useEffect, useRef } from 'react';
import { logoutEverywhere } from '@/utils/logoutEverywhere';
import {
  MAX_STAFF_IDLE_TIMEOUT_MINUTES,
  MIN_STAFF_IDLE_TIMEOUT_MINUTES,
} from '@/lib/staffIdle';

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'keydown',
  'touchstart',
  'scroll',
  'mousemove',
];

const TICK_MS = 15_000;
const HEARTBEAT_MIN_GAP_MS = 2 * 60_000;
const ACTIVITY_THROTTLE_MS = 5_000;

/**
 * Keeps the staff access JWT alive via heartbeat while the admin UI is used,
 * and force-logs out after configurable idle time (default 6 hours).
 * Any pointer/keyboard/scroll activity resets the idle window.
 */
export default function StaffSessionKeeper({ logoutRedirect = '/admin' }: { logoutRedirect?: string }) {
  const lastActivityRef = useRef(Date.now());
  const lastHeartbeatRef = useRef(0);
  const activityPendingRef = useRef(true);
  const idleEnabledRef = useRef(true);
  const idleMinutesRef = useRef(360);
  const heartbeatInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    function markActivity() {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) {
        activityPendingRef.current = true;
        return;
      }
      lastActivityRef.current = now;
      activityPendingRef.current = true;
    }

    async function heartbeat(force = false) {
      if (cancelled || heartbeatInFlight.current) return;
      const now = Date.now();
      if (!force && now - lastHeartbeatRef.current < HEARTBEAT_MIN_GAP_MS) return;

      heartbeatInFlight.current = true;
      const reportActivity = activityPendingRef.current;
      try {
        const res = await fetch('/api/auth/staff-heartbeat', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity: reportActivity }),
        });
        if (cancelled) return;

        if (res.status === 401) {
          await logoutEverywhere(logoutRedirect);
          return;
        }
        if (!res.ok) return;

        lastHeartbeatRef.current = Date.now();
        if (reportActivity) activityPendingRef.current = false;
        const data = (await res.json().catch(() => ({}))) as {
          idleTimeoutEnabled?: boolean;
          idleTimeoutMinutes?: number;
        };
        if (typeof data.idleTimeoutEnabled === 'boolean') {
          idleEnabledRef.current = data.idleTimeoutEnabled;
        }
        if (
          typeof data.idleTimeoutMinutes === 'number' &&
          Number.isFinite(data.idleTimeoutMinutes)
        ) {
          idleMinutesRef.current = Math.min(
            MAX_STAFF_IDLE_TIMEOUT_MINUTES,
            Math.max(MIN_STAFF_IDLE_TIMEOUT_MINUTES, Math.round(data.idleTimeoutMinutes)),
          );
        }
      } catch {
        /* network blip — retry on next tick */
      } finally {
        heartbeatInFlight.current = false;
      }
    }

    async function tick() {
      if (cancelled) return;
      const now = Date.now();
      const idleMs = now - lastActivityRef.current;
      const limitMs = idleMinutesRef.current * 60_000;

      if (idleEnabledRef.current && idleMs >= limitMs) {
        await logoutEverywhere(logoutRedirect);
        return;
      }

      // Renew JWT while the session is still considered active.
      if (idleMs < limitMs || !idleEnabledRef.current) {
        void heartbeat();
      }
    }

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, markActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') markActivity();
    });

    void heartbeat(true);
    const intervalId = window.setInterval(() => {
      void tick();
    }, TICK_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, markActivity);
      }
    };
  }, [logoutRedirect]);

  return null;
}
