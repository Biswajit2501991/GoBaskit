'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LocationState {
  pin: string;
  city: string;
  setPin: (pin: string) => void;
  setCity: (city: string) => void;
  clearPin: () => void;
  clearCity: () => void;
}

// Persisted delivery location (PIN code) chosen by the customer.
export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      pin: '',
      city: '',
      setPin: (pin) => set({ pin: pin.trim() }),
      setCity: (city) => set({ city: city.trim() }),
      clearPin: () => set({ pin: '' }),
      clearCity: () => set({ city: '' }),
    }),
    { name: 'gobaskit-location' }
  )
);
