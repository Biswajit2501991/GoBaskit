'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { CATEGORY_ICONS } from '@/constants';
import { resolvePublicImageUrl } from '@/utils/image';
import type { CategoryItem } from '@/types';

interface StickyCategoryChipsProps {
  categories: CategoryItem[];
  activeSlug?: string;
  onOpenAll?: () => void;
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
    <div className="border-b border-gray-100 bg-white" data-sticky-chips>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex items-center gap-2">
        {onOpenAll && (
          <button
            type="button"
            onClick={onOpenAll}
            className="shrink-0 inline-flex flex-col items-center justify-center gap-0.5 w-12 text-[10px] font-semibold text-blinkit-green"
            aria-label="See all categories"
          >
            <span className="w-9 h-9 rounded-full bg-blinkit-green-light flex items-center justify-center">
              <LayoutGrid className="w-4 h-4" />
            </span>
            All
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto scrollbar-hide overscroll-x-contain"
        >
          <div className="flex gap-1.5 w-max pr-2">
            {categories.map((cat) => {
              const active = cat.slug === activeSlug;
              const icon = CATEGORY_ICONS[cat.slug] || '🏪';
              return (
                <Link
                  key={cat.id}
                  ref={active ? activeRef : undefined}
                  href={`/category/${cat.slug}`}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold border transition-colors ${
                    active
                      ? 'bg-blinkit-green text-white border-blinkit-green'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blinkit-green/40'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-[10px] ${
                      active ? 'bg-white/20' : 'bg-white'
                    }`}
                  >
                    {cat.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolvePublicImageUrl(cat.imageUrl)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span aria-hidden>{icon}</span>
                    )}
                  </span>
                  <span className="max-w-[88px] truncate">{cat.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
