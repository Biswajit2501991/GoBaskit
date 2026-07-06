'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CategoryCard from '@/components/CategoryCard/CategoryCard';
import type { CategoryItem } from '@/types';

interface CategoryScrollerProps {
  categories: CategoryItem[];
  activeSlug?: string;
}

const MOBILE_MQ = '(max-width: 767px)';
const SCROLL_SPEED = 0.4;
const PEEK_PAUSE_MS = 1200;
const START_DELAY_MS = 600;

export default function CategoryScroller({ categories, activeSlug }: CategoryScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hintActive, setHintActive] = useState(false);
  const userInteractedRef = useRef(false);
  const animRef = useRef<number | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (userInteractedRef.current) return;
    userInteractedRef.current = true;
    setHintActive(false);
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || categories.length === 0) return;

    const mq = window.matchMedia(MOBILE_MQ);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!mq.matches || reducedMotion) return;

    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let direction = 1;
    let paused = false;
    let pauseUntil = 0;
    let targetScroll = 0;

    function computeTarget() {
      const container = scrollRef.current;
      if (!container) return 0;
      const max = container.scrollWidth - container.clientWidth;
      if (max <= 0) return 0;
      return Math.min(max, Math.max(96, max * 0.45));
    }

    function tick(now: number) {
      const container = scrollRef.current;
      if (!container || userInteractedRef.current) return;

      if (paused) {
        if (now >= pauseUntil) paused = false;
        animRef.current = requestAnimationFrame(tick);
        return;
      }

      targetScroll = computeTarget();
      if (targetScroll <= 0) return;

      container.scrollLeft += SCROLL_SPEED * direction;

      if (direction > 0 && container.scrollLeft >= targetScroll) {
        container.scrollLeft = targetScroll;
        direction = -1;
        paused = true;
        pauseUntil = now + PEEK_PAUSE_MS;
      } else if (direction < 0 && container.scrollLeft <= 0) {
        container.scrollLeft = 0;
        direction = 1;
        paused = true;
        pauseUntil = now + PEEK_PAUSE_MS + 400;
      }

      animRef.current = requestAnimationFrame(tick);
    }

    function start() {
      targetScroll = computeTarget();
      if (targetScroll <= 0) return;
      setHintActive(true);
      animRef.current = requestAnimationFrame(tick);
    }

    startTimer = setTimeout(start, START_DELAY_MS);

    const onMqChange = (e: MediaQueryListEvent) => {
      if (!e.matches) stopAutoScroll();
    };
    mq.addEventListener('change', onMqChange);

    return () => {
      clearTimeout(startTimer);
      mq.removeEventListener('change', onMqChange);
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [categories.length, stopAutoScroll]);

  return (
    <div className="mb-5 relative">
      {hintActive && (
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-1 w-12 bg-gradient-to-l from-gray-50 via-gray-50/80 to-transparent z-10 md:hidden"
          aria-hidden
        />
      )}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide"
        onTouchStart={stopAutoScroll}
        onPointerDown={stopAutoScroll}
        onWheel={stopAutoScroll}
        onClick={stopAutoScroll}
      >
        <div className="flex gap-4 pb-1">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} active={cat.slug === activeSlug} />
          ))}
        </div>
      </div>
    </div>
  );
}
