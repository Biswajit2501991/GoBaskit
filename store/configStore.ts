'use client';

import { create } from 'zustand';
import {
  SERVICEABLE_PINS,
  DELIVERY_SLABS,
  MIN_ORDER_VALUE,
  type DeliverySlab,
} from '@/constants';
import {
  DEFAULT_HEALTH_STAR_DISPLAY,
  type HealthStarDisplay,
} from '@/constants/healthStarDisplay';

interface ConfigState {
  serviceablePins: string[];
  serviceableCities: string[];
  cityAliases: Record<string, string[]>;
  pinCityMap: Record<string, string>;
  cityDefaultPins: Record<string, string>;
  deliverySlabs: DeliverySlab[];
  minOrderValue: number;
  checkoutMode: 'website' | 'whatsapp' | 'both';
  notificationSoundEnabled: boolean;
  homepageConfig: {
    showHeroBanner: boolean;
    showCategories: boolean;
    showBestSellers: boolean;
    showOffers: boolean;
    showHealthStarRating: boolean;
    healthStarDisplay: HealthStarDisplay;
    announcementBarText: string;
    deliveryTimeText: string;
    deliveryDisclaimer: string;
    themeColor: string;
    cancellationPolicy: string;
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
  refreshConfig: () => Promise<void>;
}

// Guards against duplicate in-flight requests when several components mount together.
let inFlight: Promise<void> | null = null;

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Sensible defaults so the UI works before the fetch resolves (and if it fails).
  serviceablePins: SERVICEABLE_PINS,
  serviceableCities: ['Kolkata'],
  cityAliases: {},
  pinCityMap: {},
  cityDefaultPins: {},
  deliverySlabs: DELIVERY_SLABS,
  minOrderValue: MIN_ORDER_VALUE,
  checkoutMode: 'both',
  notificationSoundEnabled: true,
  homepageConfig: {
    showHeroBanner: true,
    showCategories: true,
    showBestSellers: true,
    showOffers: true,
    showHealthStarRating: true,
    healthStarDisplay: DEFAULT_HEALTH_STAR_DISPLAY,
    announcementBarText: '',
    deliveryTimeText: 'Delivery in 10 minutes',
    deliveryDisclaimer:
      'Delivery times shown (for example “Delivery in 10 minutes”) are estimates for typical orders in our service area. Most of the time we aim to meet this timeline, but due to unusual circumstances — traffic, weather, high order volume, stock checks, or delivery distance — delivery may take longer. This estimate is not a guaranteed delivery commitment.',
    themeColor: '#facc15',
    cancellationPolicy:
      'Orders cannot be cancelled once packed for delivery. In case of unexpected delays, a refund will be provided, if applicable. Fresh items are quality-checked before dispatch — message us on WhatsApp if anything is missing or damaged.',
    promoSections: [],
  },
  loaded: false,

  fetchConfig: async () => {
    if (get().loaded) return;
    if (inFlight) return inFlight;
    inFlight = loadConfig(set, get);
    return inFlight;
  },

  refreshConfig: async () => {
    if (inFlight) return inFlight;
    inFlight = loadConfig(set, get);
    return inFlight;
  },
}));

async function loadConfig(
  set: (partial: Partial<ConfigState>) => void,
  get: () => ConfigState,
) {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const c = await res.json();
      set({
        serviceablePins: Array.isArray(c.serviceablePins) ? c.serviceablePins : get().serviceablePins,
        serviceableCities: Array.isArray(c.serviceableCities) ? c.serviceableCities : get().serviceableCities,
        cityAliases:
          typeof c.cityAliases === 'object' && c.cityAliases ? c.cityAliases : get().cityAliases,
        pinCityMap:
          typeof c.pinCityMap === 'object' && c.pinCityMap ? c.pinCityMap : get().pinCityMap,
        cityDefaultPins:
          typeof c.cityDefaultPins === 'object' && c.cityDefaultPins
            ? c.cityDefaultPins
            : get().cityDefaultPins,
        deliverySlabs: Array.isArray(c.deliverySlabs) ? c.deliverySlabs : get().deliverySlabs,
        minOrderValue: typeof c.minOrderValue === 'number' ? c.minOrderValue : get().minOrderValue,
        checkoutMode:
          c.checkoutMode === 'website' || c.checkoutMode === 'whatsapp' || c.checkoutMode === 'both'
            ? c.checkoutMode
            : get().checkoutMode,
        notificationSoundEnabled:
          typeof c.notificationSoundEnabled === 'boolean'
            ? c.notificationSoundEnabled
            : get().notificationSoundEnabled,
        homepageConfig:
          typeof c.homepageConfig === 'object' && c.homepageConfig
            ? {
                ...get().homepageConfig,
                ...c.homepageConfig,
                healthStarDisplay: {
                  ...DEFAULT_HEALTH_STAR_DISPLAY,
                  ...(c.homepageConfig.healthStarDisplay ?? {}),
                  badges:
                    Array.isArray(c.homepageConfig.healthStarDisplay?.badges) &&
                    c.homepageConfig.healthStarDisplay.badges.length
                      ? c.homepageConfig.healthStarDisplay.badges
                      : DEFAULT_HEALTH_STAR_DISPLAY.badges,
                },
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
}
