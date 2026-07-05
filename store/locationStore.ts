'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LocationState {
  pin: string;
  setPin: (pin: string) => void;
  clearPin: () => void;
}

// Persisted delivery location (PIN code) chosen by the customer.
export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      pin: '',
      setPin: (pin) => set({ pin: pin.trim() }),
      clearPin: () => set({ pin: '' }),
    }),
    { name: 'gobaskit-location' }
  )
);
