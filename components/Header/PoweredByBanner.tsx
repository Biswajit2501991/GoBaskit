'use client';

/** Single-line “Powered by…” ticker that scrolls right → left on all viewports. */
export default function PoweredByBanner({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const label = text.trim();
  if (!label) return null;

  // One continuous segment; duplicated in the DOM for a seamless loop.
  const segment = `${label}   ·   `;

  return (
    <div
      className={`powered-by-banner min-w-0 overflow-hidden ${className || 'flex-1 mx-1 sm:mx-3'}`}
      aria-label={label}
    >
      <div className="powered-by-track w-full max-w-full overflow-hidden rounded-full border border-black/10 bg-white/70 px-0 py-1.5 shadow-sm backdrop-blur-[2px]">
        <div className="powered-by-marquee">
          <span className="powered-by-text">{segment}</span>
          <span className="powered-by-text" aria-hidden="true">
            {segment}
          </span>
        </div>
      </div>
    </div>
  );
}
