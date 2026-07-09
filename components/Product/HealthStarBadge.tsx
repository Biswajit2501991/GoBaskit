'use client';

import { sizedImageUrl } from '@/utils/image';
import type { HealthStarBadgePosition } from '@/services/SettingsService';

const POSITION_CLASS: Record<HealthStarBadgePosition, string> = {
  'top-left': 'top-1.5 left-1.5',
  'top-right': 'top-1.5 right-1.5',
  'bottom-left': 'bottom-1.5 left-1.5',
  'bottom-right': 'bottom-1.5 right-1.5',
};

interface HealthStarBadgeProps {
  url: string;
  position?: HealthStarBadgePosition;
  /** Pixel width hint for resized serving */
  size?: number;
  className?: string;
}

/** Logo overlay on product image for high Health Star Rating items. */
export default function HealthStarBadge({
  url,
  position = 'top-right',
  size = 56,
  className = '',
}: HealthStarBadgeProps) {
  if (!url) return null;
  const src = sizedImageUrl(url, size) || url;
  return (
    <img
      src={src}
      alt="Health Star Rating"
      width={size}
      height={size}
      className={`absolute z-[11] w-11 h-11 sm:w-12 sm:h-12 object-contain drop-shadow-sm pointer-events-none ${POSITION_CLASS[position]} ${className}`}
    />
  );
}
