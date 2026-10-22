import Link from 'next/link';
import { CATEGORY_ICONS } from '@/constants';
import { resolvePublicImageUrl } from '@/utils/image';
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
            ? 'border-forest ring-2 ring-forest/30 bg-leaf-light'
            : 'border-paper-deep bg-[#F7F3EA] group-hover:border-leaf/50 group-hover:shadow-sm'
        }`}
      >
        {category.imageUrl ? (
          <img src={resolvePublicImageUrl(category.imageUrl)} alt={category.name} className="w-full h-full object-cover" />
        ) : (
          <span className="transition-transform group-hover:scale-110">{icon}</span>
        )}
      </div>
      <span
        className={`text-[11px] font-semibold text-center leading-tight line-clamp-2 ${
          active ? 'text-forest' : 'text-gray-700'
        }`}
      >
        {category.name}
      </span>
    </Link>
  );
}
