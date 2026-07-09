'use client';

import { sizedImageUrl } from '@/utils/image';
import type { HealthStarBadgePosition } from '@/constants/healthStarDisplay';

const POSITION_CLASS: Record<HealthStarBadgePosition, string> = {
  'top-left': 'top-1.5 left-1.5',
  'top-right': 'top-1.5 right-1.5',
  'bottom-left': 'bottom-1.5 left-1.5',
  'bottom-right': 'bottom-1.5 right-1.5',
};

interface HealthStarBadgeProps {
  url: string;
  position?: HealthStarBadgePosition;
  /** Display diameter in px (CSS size). */
  size?: number;
  className?: string;
}

/**
 * Circular Health Star sticker in the product-image corner.
 * Clips the logo to a circle so any white square canvas doesn't cut into the photo.
 */
export default function HealthStarBadge({
  url,
  position = 'top-right',
  size = 28,
  className = '',
}: HealthStarBadgeProps) {
  if (!url) return null;
  const src = sizedImageUrl(url, Math.max(64, size * 3)) || url;
  return (
    <span
      className={`absolute z-[11] rounded-full overflow-hidden bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18)] ring-1 ring-black/5 pointer-events-none ${POSITION_CLASS[position]} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="w-full h-full object-cover scale-[1.08]"
        draggable={false}
      />
      <span className="sr-only">Health Star Rating</span>
    </span>
  );
}
