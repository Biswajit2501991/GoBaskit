import { BRAND_MARK_SRC, STORE_NAME } from '@/constants';

/** Basket mark plus the GoBasket wordmark. The image has no wordmark baked in. */
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
  const ink = tone === 'paper' ? 'text-paper' : 'text-forest';
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${ink} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_MARK_SRC}
        alt=""
        className={compact ? 'h-7 w-auto shrink-0' : 'h-9 sm:h-10 w-auto shrink-0'}
      />
      <span
        className={`font-display font-semibold tracking-tight leading-none truncate ${
          compact ? 'text-lg' : 'text-xl sm:text-[1.65rem]'
        }`}
      >
        {STORE_NAME}
        {suffix ? (
          <span className={`font-sans text-[11px] font-semibold tracking-[0.14em] uppercase ml-1.5 ${tone === 'paper' ? 'text-paper/70' : 'text-forest/60'}`}>
            {suffix}
          </span>
        ) : null}
      </span>
    </span>
  );
}
