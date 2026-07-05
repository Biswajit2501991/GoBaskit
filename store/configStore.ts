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
  serviceableCities: string[];
  deliverySlabs: DeliverySlab[];
  minOrderValue: number;
  homepageConfig: {
    showHeroBanner: boolean;
    showCategories: boolean;
    showBestSellers: boolean;
    showOffers: boolean;
    announcementBarText: string;
    deliveryTimeText: string;
    themeColor: string;
    promoSections: Array<{
      id: string;
      title: string;
      subtitle: string;
      link: string;
      theme: 'green' | 'blue' | 'orange' | 'purple';
      emoji: string;
      enabled: boolean;
    }>;
  };
  loaded: boolean;
  fetchConfig: () => Promise<void>;
}

// Guards against duplicate in-flight requests when several components mount together.
let inFlight: Promise<void> | null = null;

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Sensible defaults so the UI works before the fetch resolves (and if it fails).
  serviceablePins: SERVICEABLE_PINS,
  serviceableCities: ['Kolkata'],
  deliverySlabs: DELIVERY_SLABS,
  minOrderValue: MIN_ORDER_VALUE,
  homepageConfig: {
    showHeroBanner: true,
    showCategories: true,
    showBestSellers: true,
    showOffers: true,
    announcementBarText: '',
    deliveryTimeText: 'Delivery in 10 minutes',
    themeColor: '#facc15',
    promoSections: [],
  },
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
            serviceableCities: Array.isArray(c.serviceableCities) ? c.serviceableCities : get().serviceableCities,
            deliverySlabs: Array.isArray(c.deliverySlabs) ? c.deliverySlabs : get().deliverySlabs,
            minOrderValue: typeof c.minOrderValue === 'number' ? c.minOrderValue : get().minOrderValue,
            homepageConfig:
              typeof c.homepageConfig === 'object' && c.homepageConfig
                ? {
                    ...get().homepageConfig,
                    ...c.homepageConfig,
                  }
                : get().homepageConfig,
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
