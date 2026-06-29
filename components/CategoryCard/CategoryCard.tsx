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
      className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16"
    >
      <div
        className={`w-14 h-14 rounded-full bg-yellow-50 flex items-center justify-center text-2xl border-2 transition-all ${
          active ? 'border-blinkit-green shadow-md scale-105' : 'border-transparent hover:border-gray-200'
        }`}
      >
        {category.imageUrl ? (
          <img src={category.imageUrl} alt={category.name} className="w-10 h-10 object-cover rounded-full" />
        ) : (
          icon
        )}
      </div>
      <span className={`text-[11px] font-semibold text-center leading-tight ${active ? 'text-blinkit-green' : 'text-gray-600'}`}>
        {category.name}
      </span>
    </Link>
  );
}
