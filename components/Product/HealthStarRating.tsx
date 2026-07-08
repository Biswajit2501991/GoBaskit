'use client';

import { Star } from 'lucide-react';

interface HealthStarRatingProps {
  /** Integer 1–5. Invalid / missing values render nothing. */
  rating: number | null | undefined;
  /** `card` = stacked stars + label (home). `inline` = stars beside title (detail). */
  variant?: 'card' | 'inline';
  className?: string;
}

/**
 * Golden Health Star Rating (1–5). Flashing animation is in `.health-star-rating`
 * (globals.css). Callers must only render when the admin toggle is on.
 */
export default function HealthStarRating({
  rating,
  variant = 'card',
  className = '',
}: HealthStarRatingProps) {
  const stars =
    typeof rating === 'number' && Number.isFinite(rating)
      ? Math.min(5, Math.max(1, Math.round(rating)))
      : 0;
  if (stars < 1) return null;

  if (variant === 'inline') {
    return (
      <span
        className={`health-star-rating inline-flex flex-col items-end leading-none select-none ${className}`}
        aria-label={`Health Star Rating ${stars} out of 5`}
      >
        <span className="inline-flex items-center gap-0.5">
          {Array.from({ length: stars }, (_, i) => (
            <Star
              key={i}
              className="w-4 h-4 fill-[#F5B800] text-[#F5B800] drop-shadow-sm"
              strokeWidth={0}
            />
          ))}
        </span>
        <span className="text-[9px] font-medium text-gray-500 mt-0.5 whitespace-nowrap">
          Health Star Rating
        </span>
      </span>
    );
  }

  return (
    <div
      className={`health-star-rating flex flex-col items-end leading-none select-none ${className}`}
      aria-label={`Health Star Rating ${stars} out of 5`}
    >
      <span className="inline-flex items-center gap-px">
        {Array.from({ length: stars }, (_, i) => (
          <Star
            key={i}
            className="w-2.5 h-2.5 fill-[#F5B800] text-[#F5B800] drop-shadow-sm"
            strokeWidth={0}
          />
        ))}
      </span>
      <span className="text-[7px] font-semibold text-gray-600 mt-0.5 whitespace-nowrap tracking-tight">
        Health Star Rating
      </span>
    </div>
  );
}
