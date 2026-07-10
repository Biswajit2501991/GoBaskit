'use client';

import { create } from 'zustand';

interface CartUiState {
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

export const useCartUiStore = create<CartUiState>((set) => ({
  isOpen: false,
  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),
  toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),
}));
