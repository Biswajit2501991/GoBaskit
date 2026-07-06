import { formatProductPriceLabel } from '@/utils/pricing';

interface ProductPriceDisplayProps {
  price: number;
  actualPrice?: number | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const sizeClasses = {
  xs: { selling: 'text-xs', list: 'text-[9px]' },
  sm: { selling: 'text-sm', list: 'text-xs' },
  md: { selling: 'text-2xl', list: 'text-base' },
};

export default function ProductPriceDisplay({
  price,
  actualPrice,
  size = 'xs',
  className = '',
}: ProductPriceDisplayProps) {
  const { selling, list } = formatProductPriceLabel(actualPrice, price);
  const sizes = sizeClasses[size];

  return (
    <div className={className}>
      <p className={`font-bold text-gray-900 leading-none ${sizes.selling}`}>{selling}</p>
      {list && (
        <p className={`text-gray-400 line-through mt-0.5 ${sizes.list}`}>{list}</p>
      )}
    </div>
  );
}
