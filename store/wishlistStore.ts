'use client';

import { create } from 'zustand';
import { WISHLIST_MAX_ITEMS } from '@/constants';

export type WishlistKey = string; // productId::variantKey

type WishlistState = {
  keys: Set<WishlistKey>;
  count: number;
  max: number;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  toggle: (productId: string, variantId?: string | null) => Promise<{ ok: boolean; error?: string; needsLogin?: boolean }>;
  has: (productId: string, variantId?: string | null) => boolean;
  clear: () => void;
};

export function wishlistKey(productId: string, variantId?: string | null): WishlistKey {
  return `${productId}::${variantId?.trim() || ''}`;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  keys: new Set(),
  count: 0,
  max: WISHLIST_MAX_ITEMS,
  loaded: false,
  loading: false,

  has: (productId, variantId) => get().keys.has(wishlistKey(productId, variantId)),

  clear: () => set({ keys: new Set(), count: 0, loaded: false }),

  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const res = await fetch('/api/customer/wishlist');
      if (res.status === 401) {
        set({ keys: new Set(), count: 0, loaded: true, loading: false });
        return;
      }
      if (!res.ok) {
        set({ loading: false, loaded: true });
        return;
      }
      const data = await res.json();
      const keys = new Set<WishlistKey>(Array.isArray(data.keys) ? data.keys : []);
      set({
        keys,
        count: keys.size,
        max: typeof data.max === 'number' ? data.max : WISHLIST_MAX_ITEMS,
        loaded: true,
        loading: false,
      });
    } catch {
      set({ loading: false, loaded: true });
    }
  },

  toggle: async (productId, variantId) => {
    const key = wishlistKey(productId, variantId);
    const inList = get().keys.has(key);

    if (inList) {
      const res = await fetch(
        `/api/customer/wishlist?productId=${encodeURIComponent(productId)}&variantId=${encodeURIComponent(variantId ?? '')}`,
        { method: 'DELETE' },
      );
      if (res.status === 401) return { ok: false, needsLogin: true };
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error || 'Could not update wishlist' };
      }
      const data = await res.json();
      const keys = new Set<WishlistKey>(Array.isArray(data.keys) ? data.keys : []);
      set({ keys, count: keys.size, loaded: true });
      return { ok: true };
    }

    const res = await fetch('/api/customer/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, variantId: variantId || null }),
    });
    if (res.status === 401) return { ok: false, needsLogin: true };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'Could not add to wishlist' };
    }
    const keys = new Set<WishlistKey>(Array.isArray(data.keys) ? data.keys : []);
    set({ keys, count: keys.size, loaded: true });
    return { ok: true };
  },
}));
