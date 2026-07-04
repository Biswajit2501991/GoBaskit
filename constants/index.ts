export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'GoBaskit';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gobaskitkaro.com').replace(/\/+$/, '');

export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '917899813212';

export const DELIVERY_CHARGE = Number(process.env.DELIVERY_CHARGE || 30);

export const MIN_ORDER_VALUE = Number(process.env.MIN_ORDER_VALUE || 0);

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
