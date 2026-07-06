export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'GoBaskit';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gobaskitkaro.com').replace(/\/+$/, '');

export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919046370119';

export const MIN_ORDER_VALUE = Number(process.env.MIN_ORDER_VALUE || 100);

export type DeliverySlab = { min: number; max: number; charge: number };

// A large finite cap (JSON-safe; avoids Infinity which JSON.stringify turns into null).
export const SLAB_MAX = 1_000_000_000;

// Default tiered delivery charge by order subtotal (ported from the original Go Baskit app).
// These are defaults/fallbacks; the live values are admin-editable and stored in the DB.
export const DELIVERY_SLABS: DeliverySlab[] = [
  { min: 0, max: 199, charge: 10 },
  { min: 200, max: 299, charge: 20 },
  { min: 300, max: 499, charge: 30 },
  { min: 500, max: 1000, charge: 50 },
  { min: 1001, max: 2000, charge: 70 },
  { min: 2001, max: SLAB_MAX, charge: 100 },
];

// Compute delivery charge from a given slab set.
export function deliveryChargeFrom(slabs: DeliverySlab[], subtotal: number): number {
  const tier = slabs.find((t) => subtotal >= t.min && subtotal <= t.max);
  return tier ? tier.charge : (slabs[slabs.length - 1]?.charge ?? 0);
}

// Convenience helper using the default slabs.
export function calculateDeliveryCharge(subtotal: number): number {
  return deliveryChargeFrom(DELIVERY_SLABS, subtotal);
}

// Default serviceable delivery PIN codes (comma-separated env override, else defaults).
export const SERVICEABLE_PINS = (
  process.env.NEXT_PUBLIC_SERVICEABLE_PINS || '723131,723132,723133'
)
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

export function pinIsServiceable(pins: string[], pin: string): boolean {
  return pins.includes(String(pin).trim());
}

// Re-export enhanced delivery helpers (city OR pin, aliases, GPS radius).
export {
  cityIsServiceable,
  deliveryIsServiceable,
  normalizeLocationToken,
  distanceKm,
} from '@/utils/delivery';

// Convenience helper using the default pins.
export function isPinServiceable(pin: string): boolean {
  return pinIsServiceable(SERVICEABLE_PINS, pin);
}

export const CATEGORY_ICONS: Record<string, string> = {
  vegetables: '🥬',
  fruits: '🍎',
  dairy: '🥛',
  grocery: '🛒',
  rice: '🍚',
  flour: '🌾',
  snacks: '🍿',
  drinks: '🥤',
  bakery: '🥐',
  household: '🧹',
  'personal-care': '🧴',
};

export const ORDER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const;

export const PAYMENT_METHODS = {
  COD: 'Cash On Delivery',
  QR_ON_DELIVERY: 'QR Payment on Delivery',
} as const;

export const PROMO_BANNERS = [
  { title: 'Paan Corner', subtitle: 'Your favourite paan shop is now online', bg: 'from-green-600 to-green-800', emoji: '🌿' },
  { title: 'Pharmacy at your doorstep!', subtitle: 'Cough syrups, pain relief & more', bg: 'from-blue-500 to-blue-700', emoji: '💊' },
  { title: 'Pet Care supplies', subtitle: 'Food, treats, toys & more', bg: 'from-orange-400 to-orange-600', emoji: '🐾' },
];
