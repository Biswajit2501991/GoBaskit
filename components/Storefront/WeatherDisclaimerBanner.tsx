'use client';

import { CloudRain } from 'lucide-react';
import { useConfigStore } from '@/store/configStore';

export default function WeatherDisclaimerBanner({ className = '' }: { className?: string }) {
  const weather = useConfigStore((s) => s.weatherDisclaimer);
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
