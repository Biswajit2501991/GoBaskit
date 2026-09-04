'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';
import { CATEGORY_ICONS } from '@/constants';
import { resolvePublicImageUrl } from '@/utils/image';
import type { CategoryItem } from '@/types';

interface StickyCategoryChipsProps {
  categories: CategoryItem[];
  activeSlug?: string;
  onOpenAll?: () => void;
}

const TAP_SLOP_PX = 12;

function CategoryChip({
  cat,
  active,
  activeRef,
}: {
  cat: CategoryItem;
  active: boolean;
  activeRef?: React.Ref<HTMLAnchorElement>;
}) {
  const router = useRouter();
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const navigatedByPointer = useRef(false);
  const href = `/category/${cat.slug}`;
  const icon = CATEGORY_ICONS[cat.slug] || '🏪';

  return (
    <Link
      ref={activeRef}
      href={href}
      draggable={false}
      onPointerDown={(e) => {
        navigatedByPointer.current = false;
        pointerStart.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
      onPointerUp={(e) => {
        const start = pointerStart.current;
        pointerStart.current = null;
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        if (!start) return;
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP_PX) return;
        // Android Chrome often treats a tap inside overflow-x as a pan and never
        // fires click, so Next.js Link never navigates. Drive the route on tap.
        navigatedByPointer.current = true;
        router.push(href);
      }}
      onClick={(e) => {
        if (navigatedByPointer.current) {
          e.preventDefault();
        }
      }}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 min-h-10 text-[11px] font-semibold border transition-colors touch-manipulation select-none ${
        active
          ? 'bg-blinkit-green text-white border-blinkit-green'
          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blinkit-green/40'
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-[10px] pointer-events-none ${
          active ? 'bg-white/20' : 'bg-white'
        }`}
      >
        {cat.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvePublicImageUrl(cat.imageUrl)}
            alt=""
            draggable={false}
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <span aria-hidden>{icon}</span>
        )}
      </span>
      <span className="max-w-[88px] truncate pointer-events-none">{cat.name}</span>
    </Link>
  );
}

export default function StickyCategoryChips({
  categories,
  activeSlug,
  onOpenAll,
}: StickyCategoryChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const chip = activeRef.current;
    const scroller = scrollRef.current;
    if (!chip || !scroller) return;
    const chipLeft = chip.offsetLeft;
    const chipWidth = chip.offsetWidth;
    const target = chipLeft - scroller.clientWidth / 2 + chipWidth / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activeSlug]);

  if (categories.length === 0) return null;

  return (
    <div className="border-b border-gray-100 bg-white relative z-[1]" data-sticky-chips>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex items-center gap-2">
        {onOpenAll && (
          <button
            type="button"
            onClick={onOpenAll}
            className="shrink-0 inline-flex flex-col items-center justify-center gap-0.5 w-12 min-h-10 text-[10px] font-semibold text-blinkit-green touch-manipulation"
            aria-label="See all categories"
          >
            <span className="w-9 h-9 rounded-full bg-blinkit-green-light flex items-center justify-center pointer-events-none">
              <LayoutGrid className="w-4 h-4" />
            </span>
            All
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex-1 min-w-0 overflow-x-auto scrollbar-hide overscroll-x-contain touch-pan-x"
        >
          <div className="flex gap-1.5 w-max pr-2">
            {categories.map((cat) => {
              const active = cat.slug === activeSlug;
              return (
                <CategoryChip
                  key={cat.id}
                  cat={cat}
                  active={active}
                  activeRef={active ? activeRef : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
