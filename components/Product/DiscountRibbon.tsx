interface DiscountRibbonProps {
  percent: number;
  className?: string;
}

/**
 * Eye-catching green "N% OFF" ribbon that hangs from the top-left corner of a
 * product card. Renders nothing when there is no discount. The subtle shine is
 * a CSS animation (crisper and lighter than a GIF) and is disabled for users
 * who prefer reduced motion.
 */
export default function DiscountRibbon({ percent, className = '' }: DiscountRibbonProps) {
  if (!percent || percent <= 0) return null;

  return (
    <div className={`absolute top-0 left-2 z-10 select-none pointer-events-none ${className}`}>
      <div
        className="discount-ribbon bg-blinkit-green text-white text-center px-1.5 pt-1 pb-3 shadow-md"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)' }}
      >
        <span className="block text-[11px] font-extrabold leading-none">{percent}%</span>
        <span className="block text-[8px] font-bold leading-none mt-0.5 tracking-wider">OFF</span>
      </div>
    </div>
  );
}
