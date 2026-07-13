'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { CATEGORY_ICONS } from '@/constants';
import { resolvePublicImageUrl } from '@/utils/image';
import type { CategoryItem } from '@/types';

const PAGE_SIZE = 6;
const MOBILE_MQ = '(max-width: 767px)';
const PEEK_DURATION_MS = 1800;
const END_PAUSE_MS = 700;
const START_PAUSE_MS = 1200;

interface CategoryPagerProps {
  categories: CategoryItem[];
  onSeeAll?: () => void;
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function animateScroll(el: HTMLElement, to: number, duration: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const from = el.scrollLeft;
    const start = performance.now();

    function step(now: number) {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
      el.scrollLeft = from + (to - from) * eased;
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }

    requestAnimationFrame(step);
  });
}

export default function CategoryPager({ categories, onSeeAll }: CategoryPagerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hintActive, setHintActive] = useState(false);
  const userInteractedRef = useRef(false);
  const autoScrollingRef = useRef(false);
  const loopRunningRef = useRef(false);

  const pages = useMemo(() => {
    const chunks: CategoryItem[][] = [];
    for (let i = 0; i < categories.length; i += PAGE_SIZE) {
      chunks.push(categories.slice(i, i + PAGE_SIZE));
    }
    return chunks;
  }, [categories]);

  const stopAutoScroll = useCallback(() => {
    if (userInteractedRef.current) return;
    userInteractedRef.current = true;
    setHintActive(false);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || pages.length <= 1) return;

    const mq = window.matchMedia(MOBILE_MQ);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!mq.matches || reducedMotion) return;

    const abort = new AbortController();

    function pageWidth() {
      const container = scrollRef.current;
      if (!container) return 0;
      return container.clientWidth;
    }

    async function runPeekLoop() {
      const container = scrollRef.current;
      if (!container || userInteractedRef.current || loopRunningRef.current) return;
      const width = pageWidth();
      if (width <= 0) return;

      loopRunningRef.current = true;
      autoScrollingRef.current = true;
      setHintActive(true);

      try {
        while (!userInteractedRef.current && !abort.signal.aborted) {
          await animateScroll(container, width * 0.35, PEEK_DURATION_MS, abort.signal);
          await sleep(END_PAUSE_MS, abort.signal);
          await animateScroll(container, 0, PEEK_DURATION_MS, abort.signal);
          await sleep(START_PAUSE_MS, abort.signal);
        }
      } catch {
        /* aborted */
      } finally {
        autoScrollingRef.current = false;
        loopRunningRef.current = false;
        if (!userInteractedRef.current) setHintActive(false);
      }
    }

    const startTimer = window.setTimeout(() => {
      if (!userInteractedRef.current) void runPeekLoop();
    }, 500);

    const onMqChange = (e: MediaQueryListEvent) => {
      if (!e.matches) stopAutoScroll();
    };
    mq.addEventListener('change', onMqChange);

    const onUserScroll = () => {
      if (autoScrollingRef.current) return;
      stopAutoScroll();
    };

    el.addEventListener('touchstart', stopAutoScroll, { passive: true });
    el.addEventListener('pointerdown', stopAutoScroll);
    el.addEventListener('wheel', stopAutoScroll, { passive: true });
    el.addEventListener('scroll', onUserScroll, { passive: true });

    return () => {
      clearTimeout(startTimer);
      abort.abort();
      mq.removeEventListener('change', onMqChange);
      el.removeEventListener('touchstart', stopAutoScroll);
      el.removeEventListener('pointerdown', stopAutoScroll);
      el.removeEventListener('wheel', stopAutoScroll);
      el.removeEventListener('scroll', onUserScroll);
    };
  }, [pages.length, stopAutoScroll]);

  if (categories.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-900 text-base">Shop by category</h2>
        {onSeeAll && (
          <button
            type="button"
            onClick={() => {
              stopAutoScroll();
              onSeeAll();
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blinkit-green hover:underline"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            See all
          </button>
        )}
      </div>

      <div className="relative">
        {hintActive && pages.length > 1 && (
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-gray-50 via-gray-50/90 to-transparent z-10 md:hidden"
            aria-hidden
          />
        )}
        <div
          ref={scrollRef}
          className="overflow-x-auto scrollbar-hide overscroll-x-contain snap-x snap-mandatory"
        >
          <div className="flex">
            {pages.map((page, pageIndex) => (
              <div
                key={pageIndex}
                className="min-w-full shrink-0 snap-start grid grid-cols-3 gap-2.5 sm:gap-3"
              >
                {page.map((cat) => {
                  const icon = CATEGORY_ICONS[cat.slug] || '🏪';
                  return (
                    <Link
                      key={cat.id}
                      href={`/category/${cat.slug}`}
                      onClick={stopAutoScroll}
                      className="flex flex-col items-center gap-1.5 group"
                    >
                      <div className="w-full aspect-square max-w-[88px] mx-auto rounded-2xl flex items-center justify-center text-2xl sm:text-3xl border border-gray-100 bg-gradient-to-br from-yellow-50 to-green-50 overflow-hidden group-hover:border-blinkit-green/40 group-hover:shadow-sm transition-all">
                        {cat.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolvePublicImageUrl(cat.imageUrl)}
                            alt={cat.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="transition-transform group-hover:scale-110">{icon}</span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-center leading-tight line-clamp-2 text-gray-700 px-0.5">
                        {cat.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {pages.length > 1 && (
          <p className="mt-2 text-[10px] text-gray-400 text-center md:hidden">
            Swipe for more categories
          </p>
        )}
      </div>
    </section>
  );
}
