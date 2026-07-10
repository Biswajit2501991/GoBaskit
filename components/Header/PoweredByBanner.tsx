'use client';

/** Scrolling “Powered by…” ticker so the full line is readable on mobile. */
export default function PoweredByBanner({ text }: { text: string }) {
  const label = text.trim();
  if (!label) return null;

  // Duplicate for a seamless loop.
  const loop = `${label}   ·   ${label}   ·   `;

  return (
    <div
      className="powered-by-banner flex items-center min-w-0 flex-1 mx-1 sm:mx-3 overflow-hidden"
      aria-label={label}
    >
      <div className="powered-by-track w-full max-w-full overflow-hidden rounded-full border border-black/10 bg-white/60 py-1 shadow-sm backdrop-blur-[2px]">
        <div className="powered-by-marquee flex w-max whitespace-nowrap will-change-transform">
          <span className="powered-by-text px-3 text-[10px] sm:text-[11px] font-semibold tracking-wide">
            {loop}
          </span>
          <span className="powered-by-text px-3 text-[10px] sm:text-[11px] font-semibold tracking-wide" aria-hidden>
            {loop}
          </span>
        </div>
      </div>
    </div>
  );
}
