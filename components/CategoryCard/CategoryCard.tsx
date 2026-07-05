import Link from 'next/link';
import { CATEGORY_ICONS } from '@/constants';
import type { CategoryItem } from '@/types';

interface CategoryCardProps {
  category: CategoryItem;
  active?: boolean;
}

export default function CategoryCard({ category, active }: CategoryCardProps) {
  const icon = CATEGORY_ICONS[category.slug] || '🏪';

  return (
    <Link
      href={`/category/${category.slug}`}
      className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[72px] group"
    >
      <div
        className={`w-[68px] h-[68px] rounded-2xl flex items-center justify-center text-3xl border transition-all overflow-hidden ${
          active
            ? 'border-blinkit-green ring-2 ring-blinkit-green/30 bg-blinkit-green-light'
            : 'border-gray-100 bg-gradient-to-br from-yellow-50 to-green-50 group-hover:border-blinkit-green/40 group-hover:shadow-sm'
        }`}
      >
        {category.imageUrl ? (
          <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover" />
        ) : (
          <span className="transition-transform group-hover:scale-110">{icon}</span>
        )}
      </div>
      <span
        className={`text-[11px] font-semibold text-center leading-tight line-clamp-2 ${
          active ? 'text-blinkit-green' : 'text-gray-700'
        }`}
      >
        {category.name}
      </span>
    </Link>
  );
}
