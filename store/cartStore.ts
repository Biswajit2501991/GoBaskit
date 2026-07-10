'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@/types';
import {
  MIN_ORDER_VALUE,
  calculateDeliveryCharge,
  isPinServiceable,
  SERVICEABLE_PINS,
} from '@/constants';

/** Unique key for a cart line: a product, or a specific variant of a product. */
export function cartLineKey(productId: string, variantId?: string | null): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

export function itemLineKey(item: Pick<CartItem, 'productId' | 'variantId'>): string {
  return cartLineKey(item.productId, item.variantId);
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  /** Patch live stock from the server; clamps qty and flags OOS lines. */
  syncLiveStock: (
    updates: Array<{ productId: string; variantId?: string | null; stock: number }>,
  ) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getItemCount: () => number;
  getGrandTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          // Never allow adding lines that are already out of stock.
          if (item.stock <= 0) return state;

          const key = itemLineKey(item);
          const existing = state.items.find((i) => itemLineKey(i) === key);
          if (existing) {
            if (existing.quantity >= item.stock) return state;
            const newQty = Math.min(existing.quantity + 1, item.stock);
            return {
              items: state.items.map((i) =>
                itemLineKey(i) === key
                  ? {
                      ...i,
                      quantity: newQty,
                      imageUrl: item.imageUrl ?? i.imageUrl,
                      price: item.price,
                      mrp: item.mrp ?? i.mrp,
                      stock: item.stock,
                    }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }] };
        }),

      removeItem: (key) =>
        set((state) => ({
          items: state.items.filter((i) => itemLineKey(i) !== key),
        })),

      updateQuantity: (key, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((i) => itemLineKey(i) !== key) };
          }
          return {
            items: state.items.map((i) =>
              itemLineKey(i) === key
                ? { ...i, quantity: Math.min(quantity, i.stock) }
                : i
            ),
          };
        }),

      syncLiveStock: (updates) =>
        set((state) => {
          if (!updates.length) return state;
          const byKey = new Map(
            updates.map((u) => [cartLineKey(u.productId, u.variantId), u.stock]),
          );
          let changed = false;
          const items = state.items.map((item) => {
            const key = itemLineKey(item);
            if (!byKey.has(key)) return item;
            const stock = Math.max(0, byKey.get(key)!);
            const quantity = stock <= 0 ? item.quantity : Math.min(item.quantity, stock);
            if (stock === item.stock && quantity === item.quantity) return item;
            changed = true;
            return { ...item, stock, quantity };
          });
          return changed ? { items } : state;
        }),

      clearCart: () => set({ items: [] }),

      getSubtotal: () =>
        get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

      getItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      getGrandTotal: () => {
        const subtotal = get().getSubtotal();
        return subtotal + calculateDeliveryCharge(subtotal);
      },
    }),
    { name: 'gobaskit-cart' }
  )
);

export { MIN_ORDER_VALUE, calculateDeliveryCharge, isPinServiceable, SERVICEABLE_PINS };
