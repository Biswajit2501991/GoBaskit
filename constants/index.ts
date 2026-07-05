export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'GoBaskit';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gobaskitkaro.com').replace(/\/+$/, '');

export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919046370119';

export const MIN_ORDER_VALUE = Number(process.env.MIN_ORDER_VALUE || 100);

// Tiered delivery charge by order subtotal (ported from the original Go Baskit app).
export const DELIVERY_SLABS: { min: number; max: number; charge: number }[] = [
  { min: 0, max: 199, charge: 10 },
  { min: 200, max: 299, charge: 20 },
  { min: 300, max: 499, charge: 30 },
  { min: 500, max: 1000, charge: 50 },
  { min: 1001, max: 2000, charge: 70 },
  { min: 2001, max: Infinity, charge: 100 },
];

export function calculateDeliveryCharge(subtotal: number): number {
  const tier = DELIVERY_SLABS.find((t) => subtotal >= t.min && subtotal <= t.max);
  return tier ? tier.charge : (DELIVERY_SLABS[DELIVERY_SLABS.length - 1]?.charge ?? 0);
}

// Serviceable delivery PIN codes (comma-separated env override, else defaults).
export const SERVICEABLE_PINS = (
  process.env.NEXT_PUBLIC_SERVICEABLE_PINS || '723131,723132,723133'
)
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

export function isPinServiceable(pin: string): boolean {
  return SERVICEABLE_PINS.includes(String(pin).trim());
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
