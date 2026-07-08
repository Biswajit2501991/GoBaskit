import { resolvePublicImageUrl } from '@/utils/image';

// Session-scoped guard: each image URL is only ever preloaded once per page
// session, so warming the cache is cheap and idempotent.
const preloaded = new Set<string>();

/** Warm the browser cache for a single image URL. */
export function preloadImage(url: string | null | undefined) {
  if (typeof window === 'undefined') return;
  const resolved = resolvePublicImageUrl(url);
  if (!resolved || preloaded.has(resolved)) return;
  preloaded.add(resolved);
  const img = new Image();
  img.decoding = 'async';
  img.src = resolved;
}

/** Warm the browser cache for many image URLs (deduplicated). */
export function preloadImages(urls: Array<string | null | undefined>) {
  if (typeof window === 'undefined') return;
  for (const url of urls) preloadImage(url);
}

/**
 * Preload images without blocking the main work — runs when the browser is
 * idle so it never competes with rendering the current view.
 */
export function preloadImagesIdle(urls: Array<string | null | undefined>) {
  if (typeof window === 'undefined') return;
  const run = () => preloadImages(urls);
  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
  }).requestIdleCallback;
  if (typeof ric === 'function') {
    ric(run, { timeout: 2000 });
  } else {
    setTimeout(run, 300);
  }
}
