import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export type ShopSourcingConfig = {
  enabled: boolean;
  maxShopsPerItem: number;
  offerTimeoutSeconds: number;
  maxOfferRounds: number;
  outsourceAutoStockEnabled: boolean;
  outsourceRefillAt: number;
  outsourceRefillTo: number;
};

export const DEFAULT_SHOP_SOURCING: ShopSourcingConfig = {
  enabled: false,
  maxShopsPerItem: 3,
  offerTimeoutSeconds: 300,
  maxOfferRounds: 3,
  outsourceAutoStockEnabled: false,
  outsourceRefillAt: 5,
  outsourceRefillTo: 30,
};

export const INTERNAL_WAREHOUSE_SHOP_NAME = 'GoBaskit In House';

const MAX_SHOPS_HARD_CAP = 10;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function parseShopSourcing(raw: unknown): ShopSourcingConfig {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawTimeout = src.offerTimeoutSeconds;
  // 90s was the old default; shops could not log in in time. Treat it as 5 minutes.
  const timeoutSource = rawTimeout === 90 ? DEFAULT_SHOP_SOURCING.offerTimeoutSeconds : rawTimeout;
  return {
    enabled: src.enabled === true,
    maxShopsPerItem: clampInt(src.maxShopsPerItem, 1, MAX_SHOPS_HARD_CAP, DEFAULT_SHOP_SOURCING.maxShopsPerItem),
    offerTimeoutSeconds: clampInt(
      timeoutSource,
      30,
      3600,
      DEFAULT_SHOP_SOURCING.offerTimeoutSeconds,
    ),
    maxOfferRounds: clampInt(src.maxOfferRounds, 1, 10, DEFAULT_SHOP_SOURCING.maxOfferRounds),
    outsourceAutoStockEnabled: src.outsourceAutoStockEnabled === true,
    outsourceRefillAt: clampInt(src.outsourceRefillAt, 0, 100, DEFAULT_SHOP_SOURCING.outsourceRefillAt),
    outsourceRefillTo: clampInt(src.outsourceRefillTo, 1, 9999, DEFAULT_SHOP_SOURCING.outsourceRefillTo),
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

export type ShopCatalogPlan = {
  add: string[];
  remove: string[];
  skipped: string[];
};

/** Parent/base website option (no variant row). */
export const SHOP_BASE_VARIANT_ID = '';

export function shopCatalogSkuId(productId: string, variantId?: string | null): string {
  const variant = (variantId ?? '').trim();
  return variant ? `v:${variant}` : `p:${productId}`;
}

export function parseShopCatalogSkuId(
  raw: string,
): { type: 'product' | 'variant'; id: string } | null {
  const value = String(raw ?? '').trim();
  if (value.startsWith('v:') && value.length > 2) return { type: 'variant', id: value.slice(2) };
  if (value.startsWith('p:') && value.length > 2) return { type: 'product', id: value.slice(2) };
  if (value) return { type: 'product', id: value };
  return null;
}

export function shopTagMatchesLine(params: {
  itemVariantId?: string | null;
  tags: Array<{ variantId: string; shopId?: string }>;
  shopId?: string;
}): boolean {
  const itemVariant = (params.itemVariantId ?? '').trim();
  return params.tags.some((tag) => {
    if (params.shopId && tag.shopId && tag.shopId !== params.shopId) return false;
    return (tag.variantId ?? '') === itemVariant;
  });
}

/**
 * Sync one shop’s product tags only. Never removes other shops from an item.
 * Skips adds that would exceed maxShopsPerItem (counts shops other than this one).
 */
export function planShopCatalogSync(params: {
  currentProductIds: string[];
  wantedProductIds: string[];
  otherShopCountByProduct: Record<string, number>;
  maxShopsPerItem: number;
}): ShopCatalogPlan {
  const current = new Set(params.currentProductIds.filter(Boolean));
  const wanted = new Set(params.wantedProductIds.filter(Boolean));
  const add: string[] = [];
  const remove: string[] = [];
  const skipped: string[] = [];

  for (const productId of wanted) {
    if (current.has(productId)) continue;
    const others = params.otherShopCountByProduct[productId] ?? 0;
    if (others >= params.maxShopsPerItem) {
      skipped.push(productId);
      continue;
    }
    add.push(productId);
  }
  for (const productId of current) {
    if (!wanted.has(productId)) remove.push(productId);
  }
  return { add, remove, skipped };
}

export const SHOP_FULFILLMENT_HISTORY_MS = 30 * 24 * 60 * 60 * 1000;
export const SHOP_MARGIN_FLOOR_RS = 3;

export function shopHistorySince(now = new Date()): Date {
  return new Date(now.getTime() - SHOP_FULFILLMENT_HISTORY_MS);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Next catalog selling price after a shop unit cost.
 * Never lowers the site price. Target margin is shop unit + floor (₹3).
 */
export function nextCatalogSellingPrice(
  sitePrice: number,
  shopUnitCost: number,
  floor = SHOP_MARGIN_FLOOR_RS,
): number {
  const site = roundMoney(sitePrice);
  const shop = roundMoney(shopUnitCost);
  if (!Number.isFinite(site) || site < 0) return sitePrice;
  if (!Number.isFinite(shop) || shop < 0) return site;
  if (site - shop >= floor) return site;
  return roundMoney(Math.max(site, shop + floor));
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

export function generateShopHandoverPin(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

export function isSixDigitPin(pin: string): boolean {
  const value = String(pin ?? '').trim();
  return /^\d{6}$/.test(value) && value !== '000000';
}

export function shopHandoverLookupKey(pin: string): string {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return crypto.createHmac('sha256', secret).update(`shop-handover:${String(pin).trim()}`).digest('hex');
}

export type FulfillmentCostLineInput = { id: string; costToGobaskit: number };

/** Require a finite rupee amount (>= 0) for every expected fulfillment-item id. */
export function parseFulfillmentLineCosts(
  rawItems: unknown,
  expectedIds: string[],
): { ok: true; lines: FulfillmentCostLineInput[]; total: number } | { ok: false; error: string } {
  if (!Array.isArray(rawItems)) {
    return { ok: false, error: 'Enter a cost for every item' };
  }
  const expected = [...new Set(expectedIds.filter(Boolean))];
  if (!expected.length) {
    return { ok: false, error: 'This pickup has no items' };
  }
  const expectedSet = new Set(expected);
  const seen = new Set<string>();
  const lines: FulfillmentCostLineInput[] = [];
  for (const row of rawItems) {
    if (!row || typeof row !== 'object') {
      return { ok: false, error: 'Enter a cost for every item' };
    }
    const id = typeof (row as { id?: unknown }).id === 'string' ? (row as { id: string }).id : '';
    const cost = Number((row as { costToGobaskit?: unknown }).costToGobaskit);
    if (!id || !expectedSet.has(id)) {
      return { ok: false, error: 'Unknown item on this pickup' };
    }
    if (seen.has(id)) {
      return { ok: false, error: 'Duplicate item cost' };
    }
    if (!Number.isFinite(cost) || cost < 0) {
      return { ok: false, error: 'Enter a cost of 0 or more for every item' };
    }
    seen.add(id);
    lines.push({ id, costToGobaskit: roundMoney(cost) });
  }
  if (seen.size !== expected.length) {
    return { ok: false, error: 'Enter a cost for every item' };
  }
  const total = roundMoney(lines.reduce((sum, line) => sum + line.costToGobaskit, 0));
  return { ok: true, lines, total };
}
