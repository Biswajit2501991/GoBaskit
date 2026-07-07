import { formatDiscountBadge } from '@/utils/pricing';

interface DiscountBadgeProps {
  mrp?: number | null;
  price: number;
  className?: string;
  size?: 'xs' | 'sm';
}

const sizeClasses = {
  xs: 'text-[9px] px-1.5 py-0.5',
  sm: 'text-[10px] px-2 py-0.5',
};

export default function DiscountBadge({
  mrp,
  price,
  className = '',
  size = 'xs',
}: DiscountBadgeProps) {
  const label = formatDiscountBadge(mrp, price);
  if (!label) return null;

  return (
    <span
      className={`inline-flex font-bold text-white bg-blinkit-green rounded-md ${sizeClasses[size]} ${className}`}
    >
      {label}
    </span>
  );
}
