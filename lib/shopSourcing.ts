import bcrypt from 'bcryptjs';

export type ShopSourcingConfig = {
  enabled: boolean;
  maxShopsPerItem: number;
  offerTimeoutSeconds: number;
  maxOfferRounds: number;
};

export const DEFAULT_SHOP_SOURCING: ShopSourcingConfig = {
  enabled: false,
  maxShopsPerItem: 3,
  offerTimeoutSeconds: 90,
  maxOfferRounds: 3,
};

const MAX_SHOPS_HARD_CAP = 10;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function parseShopSourcing(raw: unknown): ShopSourcingConfig {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    enabled: src.enabled === true,
    maxShopsPerItem: clampInt(src.maxShopsPerItem, 1, MAX_SHOPS_HARD_CAP, DEFAULT_SHOP_SOURCING.maxShopsPerItem),
    offerTimeoutSeconds: clampInt(
      src.offerTimeoutSeconds,
      30,
      3600,
      DEFAULT_SHOP_SOURCING.offerTimeoutSeconds,
    ),
    maxOfferRounds: clampInt(src.maxOfferRounds, 1, 10, DEFAULT_SHOP_SOURCING.maxOfferRounds),
  };
}

export function nextFulfillmentSuffix(existingCount: number): string {
  if (existingCount < 0 || existingCount >= 26) {
    throw new Error('No more shop pickup suffixes available for this order');
  }
  return String.fromCharCode(65 + existingCount);
}

export function fulfillmentTicket(orderNumber: string, suffix: string): string {
  return `${orderNumber}-${suffix}`;
}

export const SHOP_FULFILLMENT_HISTORY_MS = 30 * 24 * 60 * 60 * 1000;

export function shopHistorySince(now = new Date()): Date {
  return new Date(now.getTime() - SHOP_FULFILLMENT_HISTORY_MS);
}

export function generateDeliveryPin(): string {
  return String(1000 + Math.floor(Math.random() * 9000));
}

export async function hashDeliveryPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyDeliveryPinHash(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(String(pin ?? '').trim(), hash);
}

export function isFourDigitPin(pin: string): boolean {
  return /^\d{4}$/.test(String(pin ?? '').trim()) && pin !== '0000';
}
