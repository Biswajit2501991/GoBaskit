'use client';

import { useEffect } from 'react';
import { CloudRain } from 'lucide-react';
import { useConfigStore } from '@/store/configStore';

/** Cron can clear rain on the server; this tab must re-read /api/config to hide the banner. */
const WEATHER_CONFIG_POLL_MS = 2 * 60 * 1000;

export default function WeatherDisclaimerBanner({ className = '' }: { className?: string }) {
  const weather = useConfigStore((s) => s.weatherDisclaimer);
  const refreshConfig = useConfigStore((s) => s.refreshConfig);

  useEffect(() => {
    const poll = () => {
      void refreshConfig();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    const id = window.setInterval(poll, WEATHER_CONFIG_POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshConfig]);

  if (!weather.visible || !weather.message.trim()) return null;

  return (
    <div
      role="status"
      className={`rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-950 ${className}`}
    >
      <p className="flex items-start gap-2 font-medium leading-snug">
        <CloudRain className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden />
        <span>{weather.message}</span>
      </p>
    </div>
  );
}
