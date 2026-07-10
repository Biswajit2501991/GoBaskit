interface BestsellerBadgeProps {
  /** Extra classes for positioning (e.g. absolute placement) and sizing. */
  className?: string;
}

/**
 * Animated "BESTSELLER" tag. The flashing glow + sweeping shine come from the
 * `.bestseller-badge` CSS (globals.css) and are disabled for users who prefer
 * reduced motion. Pass positioning/size via `className`.
 */
export default function BestsellerBadge({ className = '' }: BestsellerBadgeProps) {
  return (
    <span
      className={`bestseller-badge inline-flex items-center shrink-0 whitespace-nowrap bg-blinkit-yellow text-gray-900 font-bold rounded-md shadow-sm select-none ${className}`}
    >
      BESTSELLER
    </span>
  );
}
