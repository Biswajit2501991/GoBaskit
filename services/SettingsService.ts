import { prisma } from '@/lib/prisma';
import {
  SERVICEABLE_PINS,
  DELIVERY_SLABS,
  MIN_ORDER_VALUE,
  SLAB_MAX,
  WHATSAPP_NUMBER,
  type DeliverySlab,
} from '@/constants';
import {
  DEFAULT_HEALTH_STAR_DISPLAY,
  type HealthStarDisplay,
  type HealthStarBadgePosition,
  type HealthStarDisplayMode,
} from '@/constants/healthStarDisplay';

export type {
  HealthStarDisplay,
  HealthStarBadgePosition,
  HealthStarDisplayMode,
} from '@/constants/healthStarDisplay';
export { DEFAULT_HEALTH_STAR_DISPLAY } from '@/constants/healthStarDisplay';

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
  /** PIN → canonical city (e.g. 723131 → Adra). */
  pinCityMap: Record<string, string>;
  /** City → default PIN when city is chosen (e.g. Adra → 723121). */
  cityDefaultPins: Record<string, string>;
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
  /** When true, idle staff are force-logged out after staffIdleTimeoutMinutes. */
  staffIdleTimeoutEnabled: boolean;
  /** Minutes of no activity before forced staff logout (5–240). */
  staffIdleTimeoutMinutes: number;
  homepageConfig: {
    showHeroBanner: boolean;
    showCategories: boolean;
    showBestSellers: boolean;
    showOffers: boolean;
    /** Global Health Star Rating display for products/options with a rating. */
    showHealthStarRating: boolean;
    healthStarDisplay: HealthStarDisplay;
    announcementBarText: string;
    deliveryTimeText: string;
    /** Shown when customer taps the delivery ETA chip. */
    deliveryDisclaimer: string;
    themeColor: string;
    /** Shown on cart drawer + checkout. Editable in Admin → Settings. */
    cancellationPolicy: string;
    /** Yellow header “Powered by…” animated banner. */
    showPoweredByBanner: boolean;
    poweredByText: string;
    /** Customer login modal brand seal. */
    showLoginLogo: boolean;
    loginLogoUrl: string;
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
  homepageConfig?: Partial<Omit<StoreConfig['homepageConfig'], 'promoSections' | 'healthStarDisplay'>> & {
    promoSections?: Array<Partial<StoreConfig['homepageConfig']['promoSections'][number]>>;
    healthStarDisplay?: Partial<HealthStarDisplay> & {
      badges?: Array<Partial<HealthStarDisplay['badges'][number]>>;
    };
  };
  discountConfig?: Partial<Omit<DiscountConfig, 'membership'>> & {
    membership?: Partial<DiscountConfig['membership']>;
  };
};

function parseHealthStarDisplay(raw: unknown): HealthStarDisplay {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const modeRaw = String(src.mode ?? DEFAULT_HEALTH_STAR_DISPLAY.mode);
  const mode: HealthStarDisplayMode =
    modeRaw === 'stars' || modeRaw === 'badge' || modeRaw === 'both'
      ? modeRaw
      : DEFAULT_HEALTH_STAR_DISPLAY.mode;
  const posRaw = String(src.badgePosition ?? DEFAULT_HEALTH_STAR_DISPLAY.badgePosition);
  const badgePosition: HealthStarBadgePosition =
    posRaw === 'top-left' ||
    posRaw === 'top-right' ||
    posRaw === 'bottom-left' ||
    posRaw === 'bottom-right'
      ? posRaw
      : DEFAULT_HEALTH_STAR_DISPLAY.badgePosition;
  const minRating = Number(src.badgeMinRating);
  const badgeMinRating =
    Number.isFinite(minRating) && minRating >= 1 && minRating <= 5
      ? Math.round(minRating)
      : DEFAULT_HEALTH_STAR_DISPLAY.badgeMinRating;
  const badges = Array.isArray(src.badges)
    ? src.badges
        .map((b, i) => {
          const row = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
          const url = String(row.url ?? '').trim();
          if (!url) return null;
          return {
            id: String(row.id ?? `badge-${i + 1}`).slice(0, 60),
            label: String(row.label ?? `Badge ${i + 1}`).trim().slice(0, 80) || `Badge ${i + 1}`,
            url,
          };
        })
        .filter((b): b is { id: string; label: string; url: string } => Boolean(b))
    : DEFAULT_HEALTH_STAR_DISPLAY.badges;
  let badgeUrl = String(src.badgeUrl ?? '').trim();
  if (!badgeUrl && badges.length) badgeUrl = badges[0].url;
  if (!badgeUrl) badgeUrl = DEFAULT_HEALTH_STAR_DISPLAY.badgeUrl;
  return { mode, badgePosition, badgeMinRating, badgeUrl, badges };
}

const KEY_PINS = 'serviceable_pins';
const KEY_CITIES = 'serviceable_cities';
const KEY_CITY_ALIASES = 'city_aliases';
const KEY_PIN_CITY_MAP = 'pin_city_map';
const KEY_CITY_DEFAULT_PINS = 'city_default_pins';
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
const KEY_STAFF_IDLE_TIMEOUT_ENABLED = 'staff_idle_timeout_enabled';
const KEY_STAFF_IDLE_TIMEOUT_MINUTES = 'staff_idle_timeout_minutes';
const KEY_HOMEPAGE_CONFIG = 'homepage_config';
const KEY_DISCOUNT_CONFIG = 'discount_config';

const DEFAULT_STAFF_IDLE_TIMEOUT_MINUTES = 15;

function clampIdleTimeoutMinutes(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_STAFF_IDLE_TIMEOUT_MINUTES;
  return Math.min(240, Math.max(5, Math.round(n)));
}

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
  pinCityMap: {},
  cityDefaultPins: {},
  deliverySlabs: DELIVERY_SLABS,
  minOrderValue: MIN_ORDER_VALUE,
  storeTiming: '08:00-22:00',
  storeStatus: 'OPEN',
  holidayMode: false,
  paymentMethods: ['COD', 'QR_ON_DELIVERY'],
  checkoutMode: 'both',
  notificationSoundEnabled: true,
  staffIdleTimeoutEnabled: true,
  staffIdleTimeoutMinutes: DEFAULT_STAFF_IDLE_TIMEOUT_MINUTES,
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
    healthStarDisplay: DEFAULT_HEALTH_STAR_DISPLAY,
    announcementBarText: '',
    deliveryTimeText: 'Delivery in 10 minutes',
    deliveryDisclaimer:
      'Delivery times shown (for example “Delivery in 10 minutes”) are estimates for typical orders in our service area. Most of the time we aim to meet this timeline, but due to unusual circumstances — traffic, weather, high order volume, stock checks, or delivery distance — delivery may take longer. This estimate is not a guaranteed delivery commitment.',
    themeColor: '#facc15',
    cancellationPolicy:
      'Orders cannot be cancelled once packed for delivery. In case of unexpected delays, a refund will be provided, if applicable. Fresh items are quality-checked before dispatch — message us on WhatsApp if anything is missing or damaged.',
    showPoweredByBanner: true,
    poweredByText: 'Powered by Action Plus Gym · Healthy Life · Wealthy Life',
    showLoginLogo: true,
    loginLogoUrl: '/branding/gobaskit-seal.png',
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

  let pinCityMap = DEFAULTS.pinCityMap;
  const rawPinCityMap = map.get(KEY_PIN_CITY_MAP);
  if (rawPinCityMap) {
    try {
      const parsed = JSON.parse(rawPinCityMap) as Record<string, unknown>;
      pinCityMap = Object.fromEntries(
        Object.entries(parsed)
          .map(([pin, city]) => [String(pin).trim(), String(city ?? '').trim()] as const)
          .filter(([pin, city]) => /^\d{6}$/.test(pin) && Boolean(city)),
      );
    } catch {
      pinCityMap = DEFAULTS.pinCityMap;
    }
  }

  let cityDefaultPins = DEFAULTS.cityDefaultPins;
  const rawCityDefaultPins = map.get(KEY_CITY_DEFAULT_PINS);
  if (rawCityDefaultPins) {
    try {
      const parsed = JSON.parse(rawCityDefaultPins) as Record<string, unknown>;
      cityDefaultPins = Object.fromEntries(
        Object.entries(parsed)
          .map(([city, pin]) => [String(city).trim(), String(pin ?? '').trim()] as const)
          .filter(([city, pin]) => Boolean(city) && /^\d{6}$/.test(pin)),
      );
    } catch {
      cityDefaultPins = DEFAULTS.cityDefaultPins;
    }
  }

  // Bootstrap single-city stores so checkout can auto-fill without admin setup.
  if (Object.keys(pinCityMap).length === 0 && cities.length === 1) {
    const onlyCity = cities[0];
    pinCityMap = Object.fromEntries(
      pins.filter((p) => /^\d{6}$/.test(p)).map((p) => [p, onlyCity]),
    );
  }
  if (Object.keys(cityDefaultPins).length === 0 && cities.length === 1 && pins.length > 0) {
    const onlyCity = cities[0];
    const preferred = pins.includes('723121') ? '723121' : pins[0];
    cityDefaultPins = { [onlyCity]: preferred };
  }

  let checkoutMode = DEFAULTS.checkoutMode;
  const rawCheckoutMode = map.get(KEY_CHECKOUT_MODE);
  if (rawCheckoutMode === 'website' || rawCheckoutMode === 'whatsapp' || rawCheckoutMode === 'both') {
    checkoutMode = rawCheckoutMode;
  }

  const notificationSoundEnabled =
    (map.get(KEY_NOTIFICATION_SOUND) ?? 'true').toLowerCase() !== 'false';

  const staffIdleTimeoutEnabled =
    (map.get(KEY_STAFF_IDLE_TIMEOUT_ENABLED) ?? 'true').toLowerCase() !== 'false';
  const staffIdleTimeoutMinutes = clampIdleTimeoutMinutes(
    map.get(KEY_STAFF_IDLE_TIMEOUT_MINUTES) ?? DEFAULT_STAFF_IDLE_TIMEOUT_MINUTES,
  );

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
        healthStarDisplay: parseHealthStarDisplay(parsed.healthStarDisplay),
        announcementBarText: String(parsed.announcementBarText ?? ''),
        deliveryTimeText: String(parsed.deliveryTimeText ?? DEFAULTS.homepageConfig.deliveryTimeText),
        deliveryDisclaimer:
          String(parsed.deliveryDisclaimer ?? '').trim() ||
          DEFAULTS.homepageConfig.deliveryDisclaimer,
        themeColor: String(parsed.themeColor ?? DEFAULTS.homepageConfig.themeColor),
        cancellationPolicy:
          String(parsed.cancellationPolicy ?? '').trim() ||
          DEFAULTS.homepageConfig.cancellationPolicy,
        showPoweredByBanner: parsed.showPoweredByBanner !== false,
        poweredByText:
          String(parsed.poweredByText ?? '').trim() || DEFAULTS.homepageConfig.poweredByText,
        showLoginLogo: parsed.showLoginLogo !== false,
        loginLogoUrl:
          String(parsed.loginLogoUrl ?? '').trim() || DEFAULTS.homepageConfig.loginLogoUrl,
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
    pinCityMap,
    cityDefaultPins,
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
    staffIdleTimeoutEnabled,
    staffIdleTimeoutMinutes,
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
              KEY_PIN_CITY_MAP,
              KEY_CITY_DEFAULT_PINS,
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
              KEY_STAFF_IDLE_TIMEOUT_ENABLED,
              KEY_STAFF_IDLE_TIMEOUT_MINUTES,
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
    if (partial.pinCityMap) {
      const sanitized = Object.fromEntries(
        Object.entries(partial.pinCityMap)
          .map(([pin, city]) => [String(pin).trim(), String(city).trim()] as const)
          .filter(([pin, city]) => /^\d{6}$/.test(pin) && Boolean(city)),
      );
      writes.push(upsert(KEY_PIN_CITY_MAP, JSON.stringify(sanitized)));
    }
    if (partial.cityDefaultPins) {
      const sanitized = Object.fromEntries(
        Object.entries(partial.cityDefaultPins)
          .map(([city, pin]) => [String(city).trim(), String(pin).trim()] as const)
          .filter(([city, pin]) => Boolean(city) && /^\d{6}$/.test(pin)),
      );
      writes.push(upsert(KEY_CITY_DEFAULT_PINS, JSON.stringify(sanitized)));
    }
    if (partial.checkoutMode) {
      writes.push(upsert(KEY_CHECKOUT_MODE, partial.checkoutMode));
    }
    if (partial.notificationSoundEnabled != null) {
      writes.push(
        upsert(KEY_NOTIFICATION_SOUND, partial.notificationSoundEnabled ? 'true' : 'false'),
      );
    }
    if (partial.staffIdleTimeoutEnabled != null) {
      writes.push(
        upsert(KEY_STAFF_IDLE_TIMEOUT_ENABLED, partial.staffIdleTimeoutEnabled ? 'true' : 'false'),
      );
    }
    if (partial.staffIdleTimeoutMinutes != null) {
      writes.push(
        upsert(
          KEY_STAFF_IDLE_TIMEOUT_MINUTES,
          String(clampIdleTimeoutMinutes(partial.staffIdleTimeoutMinutes)),
        ),
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
      const current = await this.getStoreConfig();
      const incomingDisplay = partial.homepageConfig.healthStarDisplay;
      const healthStarDisplay = parseHealthStarDisplay({
        ...current.homepageConfig.healthStarDisplay,
        ...(incomingDisplay ?? {}),
        badges: incomingDisplay?.badges ?? current.homepageConfig.healthStarDisplay.badges,
      });
      const hc = partial.homepageConfig;
      const safe = {
        showHeroBanner:
          hc.showHeroBanner !== undefined ? Boolean(hc.showHeroBanner) : current.homepageConfig.showHeroBanner,
        showCategories:
          hc.showCategories !== undefined ? Boolean(hc.showCategories) : current.homepageConfig.showCategories,
        showBestSellers:
          hc.showBestSellers !== undefined ? Boolean(hc.showBestSellers) : current.homepageConfig.showBestSellers,
        showOffers: hc.showOffers !== undefined ? Boolean(hc.showOffers) : current.homepageConfig.showOffers,
        showHealthStarRating:
          hc.showHealthStarRating !== undefined
            ? Boolean(hc.showHealthStarRating)
            : current.homepageConfig.showHealthStarRating,
        healthStarDisplay,
        announcementBarText:
          hc.announcementBarText !== undefined
            ? String(hc.announcementBarText ?? '').trim()
            : current.homepageConfig.announcementBarText,
        deliveryTimeText:
          String(hc.deliveryTimeText ?? '').trim() || current.homepageConfig.deliveryTimeText,
        deliveryDisclaimer:
          String(hc.deliveryDisclaimer ?? current.homepageConfig.deliveryDisclaimer ?? '').trim() ||
          DEFAULTS.homepageConfig.deliveryDisclaimer,
        themeColor:
          String(hc.themeColor ?? '').trim() || current.homepageConfig.themeColor,
        cancellationPolicy:
          String(hc.cancellationPolicy ?? current.homepageConfig.cancellationPolicy ?? '').trim() ||
          DEFAULTS.homepageConfig.cancellationPolicy,
        showPoweredByBanner:
          hc.showPoweredByBanner !== undefined
            ? Boolean(hc.showPoweredByBanner)
            : current.homepageConfig.showPoweredByBanner,
        poweredByText:
          hc.poweredByText !== undefined
            ? String(hc.poweredByText ?? '').trim() || DEFAULTS.homepageConfig.poweredByText
            : current.homepageConfig.poweredByText,
        showLoginLogo:
          hc.showLoginLogo !== undefined
            ? Boolean(hc.showLoginLogo)
            : current.homepageConfig.showLoginLogo,
        loginLogoUrl:
          hc.loginLogoUrl !== undefined
            ? String(hc.loginLogoUrl ?? '').trim() || DEFAULTS.homepageConfig.loginLogoUrl
            : current.homepageConfig.loginLogoUrl,
        promoSections: Array.isArray(hc.promoSections)
          ? hc.promoSections
              .map((section, index) => ({
                id: String(section.id ?? `promo-${index + 1}`).slice(0, 60),
                title: String(section.title ?? '').trim(),
                subtitle: String(section.subtitle ?? '').trim(),
                link: String(section.link ?? '').trim(),
                theme: (['green', 'blue', 'orange', 'purple'].includes(String(section.theme))
                  ? String(section.theme)
                  : 'green') as 'green' | 'blue' | 'orange' | 'purple',
                emoji: String(section.emoji ?? '✨').trim() || '✨',
                enabled: section.enabled === true,
              }))
              .filter((section) => section.title.length > 0)
          : current.homepageConfig.promoSections,
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
