'use client';

import { create } from 'zustand';

interface CartUiState {
  isOpen: boolean;
  /** Shown once when OOS items were auto-removed from the cart. */
  stockRemovalNotice: string | null;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  setStockRemovalNotice: (notice: string | null) => void;
  clearStockRemovalNotice: () => void;
}

export const useCartUiStore = create<CartUiState>((set) => ({
  isOpen: false,
  stockRemovalNotice: null,
  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),
  toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),
  setStockRemovalNotice: (notice) => set({ stockRemovalNotice: notice }),
  clearStockRemovalNotice: () => set({ stockRemovalNotice: null }),
}));
