'use client';

import { STORE_NAME } from '@/constants';
import { useBrandLogoUrl } from '@/components/Brand/useBrandLogo';

/** Store logo from Branding. The artwork carries the name, so no second wordmark is added. */
export default function BrandLockup({
  compact = false,
  suffix,
  tone = 'forest',
  className = '',
}: {
  compact?: boolean;
  suffix?: string;
  tone?: 'forest' | 'paper';
  className?: string;
}) {
  const src = useBrandLogoUrl();
  const ink = tone === 'paper' ? 'text-paper' : 'text-forest';
  const size = compact ? 'h-14 w-14' : 'h-20 w-20';
  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${ink} ${className}`}>
      <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ${size}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={STORE_NAME}
          className="h-[78%] w-[78%] object-contain"
        />
      </span>
      {suffix ? (
        <span
          className={`font-sans text-[11px] font-semibold tracking-[0.14em] uppercase ${
            tone === 'paper' ? 'text-paper/70' : 'text-forest/60'
          }`}
        >
          {suffix}
        </span>
      ) : null}
    </span>
  );
}
