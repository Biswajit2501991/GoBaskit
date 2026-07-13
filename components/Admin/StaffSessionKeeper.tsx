'use client';

import { useEffect, useRef } from 'react';
import { logoutEverywhere } from '@/utils/logoutEverywhere';

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
 * and force-logs out after configurable idle time (default 15 minutes).
 */
export default function StaffSessionKeeper() {
  const lastActivityRef = useRef(Date.now());
  const lastHeartbeatRef = useRef(0);
  const idleEnabledRef = useRef(true);
  const idleMinutesRef = useRef(15);
  const heartbeatInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    function markActivity() {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
    }

    async function heartbeat(force = false) {
      if (cancelled || heartbeatInFlight.current) return;
      const now = Date.now();
      if (!force && now - lastHeartbeatRef.current < HEARTBEAT_MIN_GAP_MS) return;

      heartbeatInFlight.current = true;
      try {
        const res = await fetch('/api/auth/staff-heartbeat', {
          method: 'POST',
          credentials: 'same-origin',
        });
        if (cancelled) return;

        if (res.status === 401) {
          await logoutEverywhere('/admin');
          return;
        }
        if (!res.ok) return;

        lastHeartbeatRef.current = Date.now();
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
          idleMinutesRef.current = Math.min(240, Math.max(5, Math.round(data.idleTimeoutMinutes)));
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
        await logoutEverywhere('/admin');
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
  }, []);

  return null;
}
