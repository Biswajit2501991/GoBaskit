'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import CategoryCard from '@/components/CategoryCard/CategoryCard';
import AllCategoriesModal from '@/components/CategoryCard/AllCategoriesModal';
import type { CategoryItem } from '@/types';

interface CategoryScrollerProps {
  categories: CategoryItem[];
  activeSlug?: string;
}

const MOBILE_MQ = '(max-width: 767px)';
const PEEK_DURATION_MS = 2200;
const END_PAUSE_MS = 900;
const START_PAUSE_MS = 1400;

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

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(step);
  });
}

export default function CategoryScroller({ categories, activeSlug }: CategoryScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hintActive, setHintActive] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const userInteractedRef = useRef(false);
  const autoScrollingRef = useRef(false);
  const loopRunningRef = useRef(false);

  const stopAutoScroll = useCallback(() => {
    if (userInteractedRef.current) return;
    userInteractedRef.current = true;
    setHintActive(false);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || categories.length === 0) return;

    const mq = window.matchMedia(MOBILE_MQ);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!mq.matches || reducedMotion) return;

    const abort = new AbortController();
    let resizeObserver: ResizeObserver | undefined;

    function maxScroll() {
      const container = scrollRef.current;
      if (!container) return 0;
      return Math.max(0, container.scrollWidth - container.clientWidth);
    }

    function peekTarget() {
      const max = maxScroll();
      if (max <= 0) return 0;
      return Math.min(max, Math.max(120, max * 0.55));
    }

    async function runPeekLoop() {
      const container = scrollRef.current;
      if (!container || userInteractedRef.current || loopRunningRef.current) return;

      const target = peekTarget();
      if (target <= 0) return;

      loopRunningRef.current = true;
      autoScrollingRef.current = true;
      setHintActive(true);

      try {
        while (!userInteractedRef.current && !abort.signal.aborted) {
          await animateScroll(container, target, PEEK_DURATION_MS, abort.signal);
          await sleep(END_PAUSE_MS, abort.signal);
          await animateScroll(container, 0, PEEK_DURATION_MS, abort.signal);
          await sleep(START_PAUSE_MS, abort.signal);
        }
      } catch {
        /* aborted or user interrupted */
      } finally {
        autoScrollingRef.current = false;
        loopRunningRef.current = false;
        if (!userInteractedRef.current) setHintActive(false);
      }
    }

    function tryStart() {
      if (userInteractedRef.current || abort.signal.aborted) return;
      if (peekTarget() <= 0) return;
      void runPeekLoop();
    }

    const startTimer = window.setTimeout(tryStart, 400);

    resizeObserver = new ResizeObserver(() => {
      tryStart();
    });
    resizeObserver.observe(el);

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
      resizeObserver?.disconnect();
      mq.removeEventListener('change', onMqChange);
      el.removeEventListener('touchstart', stopAutoScroll);
      el.removeEventListener('pointerdown', stopAutoScroll);
      el.removeEventListener('wheel', stopAutoScroll);
      el.removeEventListener('scroll', onUserScroll);
    };
  }, [categories.length, stopAutoScroll]);

  return (
    <div className="mb-5 relative">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-gray-900 text-sm">Shop by category</h2>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blinkit-green hover:underline"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          See all
        </button>
      </div>
      {hintActive && (
        <div
          className="pointer-events-none absolute right-0 top-8 bottom-1 w-14 bg-gradient-to-l from-gray-50 via-gray-50/90 to-transparent z-10 md:hidden"
          aria-hidden
        />
      )}
      <div
        ref={scrollRef}
        className="overflow-x-auto md:overflow-x-auto scrollbar-hide overscroll-x-contain"
      >
        <div className="flex gap-4 pb-1 w-max">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} active={cat.slug === activeSlug} />
          ))}
        </div>
      </div>

      <AllCategoriesModal
        open={showAll}
        categories={categories}
        activeSlug={activeSlug}
        onClose={() => setShowAll(false)}
      />
    </div>
  );
}
