'use client';

import { Star } from 'lucide-react';
import { useStorefrontRating } from '@/components/Header/StorefrontRatingHydrator';
import { formatStorefrontScore } from '@/lib/storefrontRating';

export default function StorefrontRatingBadge({ compact = false }: { compact?: boolean }) {
  const rating = useStorefrontRating();
  if (!rating.enabled) return null;

  const score = formatStorefrontScore(rating.score);
  const count = rating.displayCount;

  return (
    <div
      className={`min-w-0 leading-tight text-gray-900 ${compact ? 'max-w-[7.5rem] sm:max-w-none' : ''}`}
      aria-label={`${score} out of 5 from ${count}+ customer ratings`}
    >
      <p className={`flex items-center gap-0.5 font-bold ${compact ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}`}>
        <Star className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill-gray-900 text-gray-900 shrink-0`} />
        <span>
          {score} <span className="font-semibold">out of 5</span>
        </span>
      </p>
      <p className={`text-gray-800 ${compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-xs'}`}>
        {count}+ Customer Rating
      </p>
    </div>
  );
}
