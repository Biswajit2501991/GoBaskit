import { prisma } from '@/lib/prisma';
import {
  SERVICEABLE_PINS,
  DELIVERY_SLABS,
  MIN_ORDER_VALUE,
  SLAB_MAX,
  WHATSAPP_NUMBER,
  type DeliverySlab,
} from '@/constants';

export interface DiscountConfig {
  couponsEnabled: boolean;
  membershipEnabled: boolean;
  membership: {
    enabled: boolean;
    discountPercent: number;
    maxDiscount: number | null;
    usageLimitPerMember: number;
    minimumOrder: number;
    message: string;
  };
}

export interface StoreConfig {
  serviceablePins: string[];
  serviceableCities: string[];
  cityAliases: Record<string, string[]>;
  deliverySlabs: DeliverySlab[];
  minOrderValue: number;
  storeTiming: string;
  storeStatus: 'OPEN' | 'CLOSED' | 'HOLIDAY';
  holidayMode: boolean;
  paymentMethods: string[];
  whatsappTemplates: Record<string, string>;
  whatsappNumber: string;
  checkoutMode: 'website' | 'whatsapp' | 'both';
  notificationSoundEnabled: boolean;
  homepageConfig: {
    showHeroBanner: boolean;
    showCategories: boolean;
    showBestSellers: boolean;
    showOffers: boolean;
    /** Global Health Star Rating display for products/options with a rating. */
    showHealthStarRating: boolean;
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
  discountConfig: DiscountConfig;
}

type StoreConfigUpdate = Partial<Omit<StoreConfig, 'homepageConfig' | 'discountConfig'>> & {
  homepageConfig?: Partial<Omit<StoreConfig['homepageConfig'], 'promoSections'>> & {
    promoSections?: Array<Partial<StoreConfig['homepageConfig']['promoSections'][number]>>;
  };
  discountConfig?: Partial<Omit<DiscountConfig, 'membership'>> & {
    membership?: Partial<DiscountConfig['membership']>;
  };
};

const KEY_PINS = 'serviceable_pins';
const KEY_CITIES = 'serviceable_cities';
const KEY_CITY_ALIASES = 'city_aliases';
const KEY_SLABS = 'delivery_slabs';
const KEY_MIN = 'min_order_value';
const KEY_TIMING = 'store_timing';
const KEY_STATUS = 'store_status';
const KEY_HOLIDAY = 'holiday_mode';
const KEY_PAYMENT_METHODS = 'payment_methods';
const KEY_WHATSAPP_TEMPLATES = 'whatsapp_templates';
const KEY_WHATSAPP_NUMBER = 'whatsapp_number';
const KEY_CHECKOUT_MODE = 'checkout_mode';
const KEY_NOTIFICATION_SOUND = 'notification_sound_enabled';
const KEY_HOMEPAGE_CONFIG = 'homepage_config';
const KEY_DISCOUNT_CONFIG = 'discount_config';

const DEFAULT_DISCOUNT_CONFIG: DiscountConfig = {
  couponsEnabled: false,
  membershipEnabled: false,
  membership: {
    enabled: true,
    discountPercent: 10,
    maxDiscount: null,
    usageLimitPerMember: 10,
    minimumOrder: 0,
    message: 'Action Plus Membership Discount Applied',
  },
};

const DEFAULTS: StoreConfig = {
  serviceablePins: SERVICEABLE_PINS,
  serviceableCities: ['Kolkata'],
  cityAliases: {},
  deliverySlabs: DELIVERY_SLABS,
  minOrderValue: MIN_ORDER_VALUE,
  storeTiming: '08:00-22:00',
  storeStatus: 'OPEN',
  holidayMode: false,
  paymentMethods: ['COD', 'QR_ON_DELIVERY'],
  checkoutMode: 'both',
  notificationSoundEnabled: true,
  whatsappTemplates: {
    ORDER_RECEIVED: 'Your order is received and will be confirmed shortly.',
    ORDER_ACCEPTED: 'Your order has been accepted and is being prepared.',
    PREPARING: 'Your order is currently being prepared.',
    PACKED: 'Your order is packed and ready for dispatch.',
    OUT_FOR_DELIVERY: 'Your order is out for delivery.',
    DELIVERED: 'Your order has been delivered. Thank you!',
    CANCELLED: 'Your order has been cancelled. Contact support for details.',
  },
  whatsappNumber: WHATSAPP_NUMBER,
  homepageConfig: {
    showHeroBanner: true,
    showCategories: true,
    showBestSellers: true,
    showOffers: true,
    showHealthStarRating: true,
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
  discountConfig: DEFAULT_DISCOUNT_CONFIG,
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

  let cityAliases = DEFAULTS.cityAliases;
  const rawAliases = map.get(KEY_CITY_ALIASES);
  if (rawAliases) {
    try {
      const parsed = JSON.parse(rawAliases) as Record<string, unknown>;
      cityAliases = Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.map((a) => String(a).trim()).filter(Boolean) : [],
        ]),
      );
    } catch {
      cityAliases = DEFAULTS.cityAliases;
    }
  }

  let checkoutMode = DEFAULTS.checkoutMode;
  const rawCheckoutMode = map.get(KEY_CHECKOUT_MODE);
  if (rawCheckoutMode === 'website' || rawCheckoutMode === 'whatsapp' || rawCheckoutMode === 'both') {
    checkoutMode = rawCheckoutMode;
  }

  const notificationSoundEnabled =
    (map.get(KEY_NOTIFICATION_SOUND) ?? 'true').toLowerCase() !== 'false';

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

  const whatsappNumber = (map.get(KEY_WHATSAPP_NUMBER) || DEFAULTS.whatsappNumber).replace(/\D/g, '') || DEFAULTS.whatsappNumber;

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
        showHealthStarRating: parsed.showHealthStarRating !== false,
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

  let discountConfig = DEFAULT_DISCOUNT_CONFIG;
  const rawDiscountConfig = map.get(KEY_DISCOUNT_CONFIG);
  if (rawDiscountConfig) {
    try {
      const parsed = JSON.parse(rawDiscountConfig) as Record<string, unknown>;
      const mem = (parsed.membership ?? {}) as Record<string, unknown>;
      discountConfig = {
        couponsEnabled: parsed.couponsEnabled === true,
        membershipEnabled: parsed.membershipEnabled === true,
        membership: {
          enabled: mem.enabled !== false,
          discountPercent: Math.min(
            100,
            Math.max(0, Number(mem.discountPercent ?? DEFAULT_DISCOUNT_CONFIG.membership.discountPercent) || 0),
          ),
          maxDiscount:
            mem.maxDiscount == null || mem.maxDiscount === ''
              ? null
              : Math.max(0, Number(mem.maxDiscount) || 0),
          usageLimitPerMember: Math.max(
            1,
            Math.trunc(Number(mem.usageLimitPerMember ?? DEFAULT_DISCOUNT_CONFIG.membership.usageLimitPerMember) || 10),
          ),
          minimumOrder: Math.max(0, Number(mem.minimumOrder ?? 0) || 0),
          message:
            String(mem.message ?? '').trim() || DEFAULT_DISCOUNT_CONFIG.membership.message,
        },
      };
    } catch {
      discountConfig = DEFAULT_DISCOUNT_CONFIG;
    }
  }

  return {
    serviceablePins: pins,
    serviceableCities: cities,
    cityAliases,
    deliverySlabs: slabs,
    minOrderValue,
    storeTiming,
    storeStatus,
    holidayMode,
    paymentMethods,
    whatsappTemplates,
    whatsappNumber,
    checkoutMode,
    notificationSoundEnabled,
    homepageConfig,
    discountConfig,
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
              KEY_CITY_ALIASES,
              KEY_SLABS,
              KEY_MIN,
              KEY_TIMING,
              KEY_STATUS,
              KEY_HOLIDAY,
              KEY_PAYMENT_METHODS,
              KEY_WHATSAPP_TEMPLATES,
              KEY_WHATSAPP_NUMBER,
              KEY_CHECKOUT_MODE,
              KEY_NOTIFICATION_SOUND,
              KEY_HOMEPAGE_CONFIG,
              KEY_DISCOUNT_CONFIG,
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
    if (partial.cityAliases) {
      const sanitized = Object.fromEntries(
        Object.entries(partial.cityAliases).map(([k, v]) => [
          String(k).trim().toLowerCase(),
          [...new Set(v.map((a) => String(a).trim()).filter(Boolean))],
        ]),
      );
      writes.push(upsert(KEY_CITY_ALIASES, JSON.stringify(sanitized)));
    }
    if (partial.checkoutMode) {
      writes.push(upsert(KEY_CHECKOUT_MODE, partial.checkoutMode));
    }
    if (partial.notificationSoundEnabled != null) {
      writes.push(
        upsert(KEY_NOTIFICATION_SOUND, partial.notificationSoundEnabled ? 'true' : 'false'),
      );
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
    if (partial.whatsappNumber != null) {
      const digits = String(partial.whatsappNumber).replace(/\D/g, '');
      if (digits.length >= 8) {
        writes.push(upsert(KEY_WHATSAPP_NUMBER, digits));
      }
    }
    if (partial.homepageConfig) {
      const safe = {
        showHeroBanner: partial.homepageConfig.showHeroBanner !== false,
        showCategories: partial.homepageConfig.showCategories !== false,
        showBestSellers: partial.homepageConfig.showBestSellers !== false,
        showOffers: partial.homepageConfig.showOffers !== false,
        showHealthStarRating: partial.homepageConfig.showHealthStarRating !== false,
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
    if (partial.discountConfig) {
      const current = await this.getStoreConfig();
      const merged: DiscountConfig = {
        couponsEnabled:
          partial.discountConfig.couponsEnabled ?? current.discountConfig.couponsEnabled,
        membershipEnabled:
          partial.discountConfig.membershipEnabled ?? current.discountConfig.membershipEnabled,
        membership: {
          ...current.discountConfig.membership,
          ...(partial.discountConfig.membership ?? {}),
          discountPercent: Math.min(
            100,
            Math.max(
              0,
              Number(
                partial.discountConfig.membership?.discountPercent ??
                  current.discountConfig.membership.discountPercent,
              ) || 0,
            ),
          ),
          maxDiscount:
            partial.discountConfig.membership && 'maxDiscount' in partial.discountConfig.membership
              ? partial.discountConfig.membership.maxDiscount == null
                ? null
                : Math.max(0, Number(partial.discountConfig.membership.maxDiscount) || 0)
              : current.discountConfig.membership.maxDiscount,
          usageLimitPerMember: Math.max(
            1,
            Math.trunc(
              Number(
                partial.discountConfig.membership?.usageLimitPerMember ??
                  current.discountConfig.membership.usageLimitPerMember,
              ) || 10,
            ),
          ),
          minimumOrder: Math.max(
            0,
            Number(
              partial.discountConfig.membership?.minimumOrder ??
                current.discountConfig.membership.minimumOrder,
            ) || 0,
          ),
          message:
            String(
              partial.discountConfig.membership?.message ??
                current.discountConfig.membership.message,
            ).trim() || DEFAULT_DISCOUNT_CONFIG.membership.message,
          enabled: partial.discountConfig.membership?.enabled ?? current.discountConfig.membership.enabled,
        },
      };
      writes.push(upsert(KEY_DISCOUNT_CONFIG, JSON.stringify(merged)));
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
