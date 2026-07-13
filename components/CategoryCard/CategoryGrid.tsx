'use client';

import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { CATEGORY_ICONS } from '@/constants';
import { resolvePublicImageUrl } from '@/utils/image';
import type { CategoryItem } from '@/types';

interface CategoryGridProps {
  categories: CategoryItem[];
  onSeeAll?: () => void;
}

export default function CategoryGrid({ categories, onSeeAll }: CategoryGridProps) {
  if (categories.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-900 text-base">Shop by category</h2>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blinkit-green hover:underline"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            See all
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5 sm:gap-3">
        {categories.map((cat) => {
          const icon = CATEGORY_ICONS[cat.slug] || '🏪';
          return (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
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
    </section>
  );
}
