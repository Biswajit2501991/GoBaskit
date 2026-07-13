'use client';

import Link from 'next/link';
import ProductCard from '@/components/ProductCard/ProductCard';
import type { ProductWithCategory } from '@/types';

interface ProductRailProps {
  title: string;
  products: ProductWithCategory[];
  seeAllHref?: string;
  seeAllLabel?: string;
}

export default function ProductRail({
  title,
  products,
  seeAllHref,
  seeAllLabel = 'See all',
}: ProductRailProps) {
  if (products.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="font-bold text-gray-900 text-base">{title}</h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="text-xs font-semibold text-blinkit-green hover:underline shrink-0"
          >
            {seeAllLabel}
          </Link>
        )}
      </div>
      <div className="overflow-x-auto scrollbar-hide overscroll-x-contain -mx-4 px-4">
        <div className="flex gap-2 w-max pb-1">
          {products.map((p) => (
            <div key={p.id} className="w-[148px] sm:w-[160px] shrink-0">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
