'use client';

import { create } from 'zustand';
import {
  SERVICEABLE_PINS,
  DELIVERY_SLABS,
  MIN_ORDER_VALUE,
  type DeliverySlab,
} from '@/constants';

interface ConfigState {
  serviceablePins: string[];
  deliverySlabs: DeliverySlab[];
  minOrderValue: number;
  loaded: boolean;
  fetchConfig: () => Promise<void>;
}

// Guards against duplicate in-flight requests when several components mount together.
let inFlight: Promise<void> | null = null;

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Sensible defaults so the UI works before the fetch resolves (and if it fails).
  serviceablePins: SERVICEABLE_PINS,
  deliverySlabs: DELIVERY_SLABS,
  minOrderValue: MIN_ORDER_VALUE,
  loaded: false,

  fetchConfig: async () => {
    if (get().loaded) return;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const c = await res.json();
          set({
            serviceablePins: Array.isArray(c.serviceablePins) ? c.serviceablePins : get().serviceablePins,
            deliverySlabs: Array.isArray(c.deliverySlabs) ? c.deliverySlabs : get().deliverySlabs,
            minOrderValue: typeof c.minOrderValue === 'number' ? c.minOrderValue : get().minOrderValue,
            loaded: true,
          });
        }
      } catch {
        /* keep defaults */
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },
}));
