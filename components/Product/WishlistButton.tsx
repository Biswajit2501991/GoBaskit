'use client';

import { Heart } from 'lucide-react';
import { useWishlistStore } from '@/store/wishlistStore';
import { useStaffPortalStore } from '@/store/staffPortalStore';

type WishlistButtonProps = {
  productId: string;
  variantId?: string | null;
  className?: string;
  size?: 'sm' | 'md';
};

export default function WishlistButton({
  productId,
  variantId = null,
  className = '',
  size = 'sm',
}: WishlistButtonProps) {
  const has = useWishlistStore((s) => s.has(productId, variantId));
  const toggle = useWishlistStore((s) => s.toggle);
  const openAccountModal = useStaffPortalStore((s) => s.openAccountModal);
  const iconClass = size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5';

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const result = await toggle(productId, variantId);
    if (result.needsLogin) {
      openAccountModal();
      return;
    }
    if (!result.ok && result.error) {
      window.alert(result.error);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={has ? 'Remove from wishlist' : 'Add to wishlist'}
      title={has ? 'Remove from wishlist' : 'Save for later / notify on restock'}
      className={`inline-flex items-center justify-center rounded-full bg-white/90 border border-gray-200 shadow-sm hover:border-blinkit-green ${className}`}
    >
      <Heart
        className={`${iconClass} ${has ? 'fill-red-500 text-red-500' : 'text-gray-500'}`}
      />
    </button>
  );
}
