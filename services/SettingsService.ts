import { prisma } from '@/lib/prisma';
import {
  SERVICEABLE_PINS,
  DELIVERY_SLABS,
  MIN_ORDER_VALUE,
  SLAB_MAX,
  type DeliverySlab,
} from '@/constants';

export interface StoreConfig {
  serviceablePins: string[];
  serviceableCities: string[];
  deliverySlabs: DeliverySlab[];
  minOrderValue: number;
  storeTiming: string;
  storeStatus: 'OPEN' | 'CLOSED' | 'HOLIDAY';
  holidayMode: boolean;
  paymentMethods: string[];
  whatsappTemplates: Record<string, string>;
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
}

type StoreConfigUpdate = Partial<Omit<StoreConfig, 'homepageConfig'>> & {
  homepageConfig?: Partial<StoreConfig['homepageConfig']>;
};

const KEY_PINS = 'serviceable_pins';
const KEY_CITIES = 'serviceable_cities';
const KEY_SLABS = 'delivery_slabs';
const KEY_MIN = 'min_order_value';
const KEY_TIMING = 'store_timing';
const KEY_STATUS = 'store_status';
const KEY_HOLIDAY = 'holiday_mode';
const KEY_PAYMENT_METHODS = 'payment_methods';
const KEY_WHATSAPP_TEMPLATES = 'whatsapp_templates';
const KEY_HOMEPAGE_CONFIG = 'homepage_config';

const DEFAULTS: StoreConfig = {
  serviceablePins: SERVICEABLE_PINS,
  serviceableCities: ['Kolkata'],
  deliverySlabs: DELIVERY_SLABS,
  minOrderValue: MIN_ORDER_VALUE,
  storeTiming: '08:00-22:00',
  storeStatus: 'OPEN',
  holidayMode: false,
  paymentMethods: ['COD', 'QR_ON_DELIVERY'],
  whatsappTemplates: {
    ORDER_RECEIVED: 'Your order is received and will be confirmed shortly.',
    ORDER_ACCEPTED: 'Your order has been accepted and is being prepared.',
    PREPARING: 'Your order is currently being prepared.',
    PACKED: 'Your order is packed and ready for dispatch.',
    OUT_FOR_DELIVERY: 'Your order is out for delivery.',
    DELIVERED: 'Your order has been delivered. Thank you!',
    CANCELLED: 'Your order has been cancelled. Contact support for details.',
  },
  homepageConfig: {
    showHeroBanner: true,
    showCategories: true,
    showBestSellers: true,
    showOffers: true,
    announcementBarText: '',
    deliveryTimeText: 'Delivery in 10 minutes',
    themeColor: '#facc15',
    promoSections: [
      {
        id: 'paan-corner',
        title: 'Paan Corner',
        subtitle: 'Your favourite paan shop is now online',
        link: '/category/paan-corner',
        theme: 'green',
        emoji: '🌿',
        enabled: true,
      },
      {
        id: 'pharmacy',
        title: 'Pharmacy at your doorstep!',
        subtitle: 'Cough syrups, pain relief & more',
        link: '/category/pharmacy',
        theme: 'blue',
        emoji: '💊',
        enabled: true,
      },
      {
        id: 'pet-care',
        title: 'Pet Care supplies',
        subtitle: 'Food, treats, toys & more',
        link: '/category/pet-care',
        theme: 'orange',
        emoji: '🐾',
        enabled: true,
      },
    ],
  },
};

// In-memory cache. The app runs as a single long-lived Node server, so this
// keeps DB reads for settings to at most one per TTL window (plus a refresh
// right after an admin save, which invalidates the cache).
const TTL_MS = 5 * 60 * 1000;
let cache: { data: StoreConfig; expiresAt: number } | null = null;

function toStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return null;
}

function toSlabs(value: unknown): DeliverySlab[] | null {
  if (!Array.isArray(value)) return null;
  const slabs = value
    .map((s) => ({
      min: Number((s as DeliverySlab).min),
      max: Number((s as DeliverySlab).max),
      charge: Number((s as DeliverySlab).charge),
    }))
    .filter((s) => Number.isFinite(s.min) && Number.isFinite(s.max) && Number.isFinite(s.charge));
  return slabs.length ? slabs.sort((a, b) => a.min - b.min) : null;
}

function parseRows(rows: { key: string; value: string }[]): StoreConfig {
  const map = new Map(rows.map((r) => [r.key, r.value]));

  let pins = DEFAULTS.serviceablePins;
  const rawPins = map.get(KEY_PINS);
  if (rawPins) {
    try {
      pins = toStringArray(JSON.parse(rawPins)) ?? pins;
    } catch {
      pins = rawPins.split(',').map((p) => p.trim()).filter(Boolean);
    }
  }

  let slabs = DEFAULTS.deliverySlabs;
  const rawSlabs = map.get(KEY_SLABS);
  if (rawSlabs) {
    try {
      slabs = toSlabs(JSON.parse(rawSlabs)) ?? slabs;
    } catch {
      /* keep default */
    }
  }

  let cities = DEFAULTS.serviceableCities;
  const rawCities = map.get(KEY_CITIES);
  if (rawCities) {
    try {
      cities = toStringArray(JSON.parse(rawCities)) ?? cities;
    } catch {
      cities = rawCities.split(',').map((c) => c.trim()).filter(Boolean);
    }
  }

  let minOrderValue = DEFAULTS.minOrderValue;
  const rawMin = map.get(KEY_MIN);
  if (rawMin != null && rawMin !== '') {
    const n = Number(rawMin);
    if (Number.isFinite(n) && n >= 0) minOrderValue = n;
  }

  const storeTiming = map.get(KEY_TIMING) || DEFAULTS.storeTiming;

  const rawStatus = (map.get(KEY_STATUS) || DEFAULTS.storeStatus).toUpperCase();
  const storeStatus =
    rawStatus === 'OPEN' || rawStatus === 'CLOSED' || rawStatus === 'HOLIDAY'
      ? rawStatus
      : DEFAULTS.storeStatus;

  const holidayMode = (map.get(KEY_HOLIDAY) || 'false').toLowerCase() === 'true';

  let paymentMethods = DEFAULTS.paymentMethods;
  const rawPaymentMethods = map.get(KEY_PAYMENT_METHODS);
  if (rawPaymentMethods) {
    try {
      paymentMethods = toStringArray(JSON.parse(rawPaymentMethods)) ?? paymentMethods;
    } catch {
      paymentMethods = rawPaymentMethods.split(',').map((v) => v.trim()).filter(Boolean);
    }
  }

  let whatsappTemplates = DEFAULTS.whatsappTemplates;
  const rawTemplates = map.get(KEY_WHATSAPP_TEMPLATES);
  if (rawTemplates) {
    try {
      const parsed = JSON.parse(rawTemplates) as Record<string, unknown>;
      whatsappTemplates = Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k, String(v ?? '').trim()]),
      );
    } catch {
      whatsappTemplates = DEFAULTS.whatsappTemplates;
    }
  }

  let homepageConfig = DEFAULTS.homepageConfig;
  const rawHomepageConfig = map.get(KEY_HOMEPAGE_CONFIG);
  if (rawHomepageConfig) {
    try {
      const parsed = JSON.parse(rawHomepageConfig) as Record<string, unknown>;
      homepageConfig = {
        showHeroBanner: parsed.showHeroBanner !== false,
        showCategories: parsed.showCategories !== false,
        showBestSellers: parsed.showBestSellers !== false,
        showOffers: parsed.showOffers !== false,
        announcementBarText: String(parsed.announcementBarText ?? ''),
        deliveryTimeText: String(parsed.deliveryTimeText ?? DEFAULTS.homepageConfig.deliveryTimeText),
        themeColor: String(parsed.themeColor ?? DEFAULTS.homepageConfig.themeColor),
        promoSections: Array.isArray(parsed.promoSections)
          ? parsed.promoSections
              .map((section, index) => ({
                id: String((section as { id?: unknown }).id ?? `promo-${index + 1}`).slice(0, 60),
                title: String((section as { title?: unknown }).title ?? '').trim(),
                subtitle: String((section as { subtitle?: unknown }).subtitle ?? '').trim(),
                link: String((section as { link?: unknown }).link ?? '').trim(),
                theme: (['green', 'blue', 'orange', 'purple'].includes(
                  String((section as { theme?: unknown }).theme ?? ''),
                )
                  ? String((section as { theme?: unknown }).theme)
                  : 'green') as 'green' | 'blue' | 'orange' | 'purple',
                emoji: String((section as { emoji?: unknown }).emoji ?? '✨').trim() || '✨',
                enabled: (section as { enabled?: unknown }).enabled !== false,
              }))
              .filter((section) => section.title.length > 0)
          : DEFAULTS.homepageConfig.promoSections,
      };
    } catch {
      homepageConfig = DEFAULTS.homepageConfig;
    }
  }

  return {
    serviceablePins: pins,
    serviceableCities: cities,
    deliverySlabs: slabs,
    minOrderValue,
    storeTiming,
    storeStatus,
    holidayMode,
    paymentMethods,
    whatsappTemplates,
    homepageConfig,
  };
}

export const SettingsService = {
  /** Cached read of the store config. Hits the DB at most once per TTL. */
  async getStoreConfig(): Promise<StoreConfig> {
    if (cache && cache.expiresAt > Date.now()) return cache.data;
    try {
      const rows = await prisma.setting.findMany({
        where: {
          key: {
            in: [
              KEY_PINS,
              KEY_CITIES,
              KEY_SLABS,
              KEY_MIN,
              KEY_TIMING,
              KEY_STATUS,
              KEY_HOLIDAY,
              KEY_PAYMENT_METHODS,
              KEY_WHATSAPP_TEMPLATES,
              KEY_HOMEPAGE_CONFIG,
            ],
          },
        },
        select: { key: true, value: true },
      });
      const data = parseRows(rows);
      cache = { data, expiresAt: Date.now() + TTL_MS };
      return data;
    } catch {
      // On DB error, serve last-known cache or defaults; never throw.
      return cache?.data ?? DEFAULTS;
    }
  },

  /** Persist changed settings and invalidate the cache. */
  async updateStoreConfig(partial: StoreConfigUpdate): Promise<StoreConfig> {
    const writes: Promise<unknown>[] = [];

    if (partial.serviceablePins) {
      const pins = partial.serviceablePins
        .map((p) => String(p).trim())
        .filter((p) => /^\d{6}$/.test(p));
      writes.push(upsert(KEY_PINS, JSON.stringify([...new Set(pins)])));
    }
    if (partial.serviceableCities) {
      const cities = partial.serviceableCities
        .map((c) => String(c).trim())
        .filter(Boolean);
      writes.push(upsert(KEY_CITIES, JSON.stringify([...new Set(cities)])));
    }
    if (partial.deliverySlabs) {
      const slabs = partial.deliverySlabs
        .map((s) => ({
          min: Math.max(0, Math.round(Number(s.min))),
          max: Math.min(SLAB_MAX, Math.round(Number(s.max))),
          charge: Math.max(0, Number(s.charge)),
        }))
        .filter((s) => Number.isFinite(s.min) && Number.isFinite(s.max) && Number.isFinite(s.charge))
        .sort((a, b) => a.min - b.min);
      writes.push(upsert(KEY_SLABS, JSON.stringify(slabs)));
    }
    if (partial.minOrderValue != null && Number.isFinite(partial.minOrderValue)) {
      writes.push(upsert(KEY_MIN, String(Math.max(0, Math.round(partial.minOrderValue)))));
    }
    if (partial.storeTiming != null) {
      writes.push(upsert(KEY_TIMING, String(partial.storeTiming).trim() || DEFAULTS.storeTiming));
    }
    if (partial.storeStatus != null) {
      writes.push(upsert(KEY_STATUS, partial.storeStatus));
    }
    if (partial.holidayMode != null) {
      writes.push(upsert(KEY_HOLIDAY, partial.holidayMode ? 'true' : 'false'));
    }
    if (partial.paymentMethods) {
      const methods = partial.paymentMethods.map((m) => String(m).trim()).filter(Boolean);
      writes.push(upsert(KEY_PAYMENT_METHODS, JSON.stringify([...new Set(methods)])));
    }
    if (partial.whatsappTemplates) {
      const sanitized = Object.fromEntries(
        Object.entries(partial.whatsappTemplates).map(([k, v]) => [k, String(v ?? '').trim()]),
      );
      writes.push(upsert(KEY_WHATSAPP_TEMPLATES, JSON.stringify(sanitized)));
    }
    if (partial.homepageConfig) {
      const safe = {
        showHeroBanner: partial.homepageConfig.showHeroBanner !== false,
        showCategories: partial.homepageConfig.showCategories !== false,
        showBestSellers: partial.homepageConfig.showBestSellers !== false,
        showOffers: partial.homepageConfig.showOffers !== false,
        announcementBarText: String(partial.homepageConfig.announcementBarText ?? '').trim(),
        deliveryTimeText:
          String(partial.homepageConfig.deliveryTimeText ?? '').trim() || DEFAULTS.homepageConfig.deliveryTimeText,
        themeColor:
          String(partial.homepageConfig.themeColor ?? '').trim() || DEFAULTS.homepageConfig.themeColor,
        promoSections: Array.isArray(partial.homepageConfig.promoSections)
          ? partial.homepageConfig.promoSections
              .map((section, index) => ({
                id: String(section.id ?? `promo-${index + 1}`).slice(0, 60),
                title: String(section.title ?? '').trim(),
                subtitle: String(section.subtitle ?? '').trim(),
                link: String(section.link ?? '').trim(),
                theme: (['green', 'blue', 'orange', 'purple'].includes(String(section.theme))
                  ? String(section.theme)
                  : 'green') as 'green' | 'blue' | 'orange' | 'purple',
                emoji: String(section.emoji ?? '✨').trim() || '✨',
                enabled: section.enabled !== false,
              }))
              .filter((section) => section.title.length > 0)
          : DEFAULTS.homepageConfig.promoSections,
      };
      writes.push(upsert(KEY_HOMEPAGE_CONFIG, JSON.stringify(safe)));
    }

    await Promise.all(writes);
    cache = null; // invalidate so the next read reflects the change
    return this.getStoreConfig();
  },

  invalidate() {
    cache = null;
  },
};

function upsert(key: string, value: string) {
  return prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
