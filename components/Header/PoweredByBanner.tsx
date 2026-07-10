'use client';

/** Animated “Powered by…” ticker for the yellow header bar. */
export default function PoweredByBanner({ text }: { text: string }) {
  const label = text.trim();
  if (!label) return null;

  return (
    <div
      className="powered-by-banner flex items-center justify-center min-w-0 flex-1 mx-1 sm:mx-3 overflow-hidden"
      aria-label={label}
    >
      <div className="powered-by-track relative max-w-full overflow-hidden rounded-full border border-black/10 bg-white/55 px-2.5 sm:px-3 py-1 shadow-sm backdrop-blur-[2px]">
        <p className="powered-by-text truncate sm:whitespace-nowrap text-[9px] sm:text-[11px] font-semibold tracking-wide text-gray-800">
          {label}
        </p>
      </div>
    </div>
  );
}
