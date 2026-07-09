import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppliedDiscountType = 'COUPON' | 'MEMBERSHIP';

export interface AppliedDiscount {
  type: AppliedDiscountType;
  discountAmount: number;
  couponCode?: string;
  memberId?: string | null;
  message: string;
  youSavedLabel: string;
  /** Subtotal used when the quote was computed — re-validate if cart changes. */
  quotedSubtotal: number;
}

interface DiscountState {
  applied: AppliedDiscount | null;
  setApplied: (discount: AppliedDiscount | null) => void;
  clear: () => void;
}

export const useDiscountStore = create<DiscountState>()(
  persist(
    (set) => ({
      applied: null,
      setApplied: (discount) => set({ applied: discount }),
      clear: () => set({ applied: null }),
    }),
    { name: 'gobaskit-discount' },
  ),
);
