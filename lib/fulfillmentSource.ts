import { roundMoney } from '@/lib/shopSourcing';

export const FULFILLMENT_SOURCES = ['UNSET', 'IN_HOUSE', 'OUTSOURCE'] as const;
export type FulfillmentSource = (typeof FULFILLMENT_SOURCES)[number];

export function parseFulfillmentSource(raw: unknown): FulfillmentSource | null {
  const value = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!value) return 'UNSET';
  if (value === 'UNSET' || value === 'UNTAGGED' || value === 'NONE') return 'UNSET';
  if (value === 'IN_HOUSE' || value === 'INHOUSE') return 'IN_HOUSE';
  if (value === 'OUTSOURCE' || value === 'OUTSOURCED') return 'OUTSOURCE';
  return null;
}

export function coerceFulfillmentSource(raw: unknown): FulfillmentSource {
  return parseFulfillmentSource(raw) ?? 'UNSET';
}

export function parseCostPrice(raw: unknown): number | null {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundMoney(n);
}

export const FULFILLMENT_ROUTES = ['IN_HOUSE', 'SHOP'] as const;
export type FulfillmentRoute = (typeof FULFILLMENT_ROUTES)[number];

export function parseFulfillmentRoute(raw: unknown): FulfillmentRoute | null {
  const value = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (value === 'IN_HOUSE' || value === 'INHOUSE' || value === 'WAREHOUSE') return 'IN_HOUSE';
  if (value === 'SHOP' || value === 'SHOPS') return 'SHOP';
  return null;
}

/** Per-order path. Catalog tag is never flipped. */
export function decideFulfillmentRoute(params: {
  source: FulfillmentSource | string | null | undefined;
  availableStock: number;
  quantity: number;
  shopSourcingEnabled: boolean;
}): FulfillmentRoute | null {
  const source = coerceFulfillmentSource(params.source);
  const qty = Math.max(0, Math.floor(Number(params.quantity) || 0));
  const stock = Number(params.availableStock);
  const inStock = Number.isFinite(stock) && stock >= qty && qty > 0;

  if (source === 'OUTSOURCE') return 'SHOP';
  if (source === 'IN_HOUSE') {
    if (inStock) return 'IN_HOUSE';
    if (params.shopSourcingEnabled) return 'SHOP';
    return 'IN_HOUSE';
  }
  return null;
}

/** Warehouse stock is reserved for Outsource buffers and In House lines that stay in-house. */
export function shouldReserveWarehouseStock(params: {
  fulfillmentSource: FulfillmentSource | string | null | undefined;
  fulfillmentRoute: FulfillmentRoute | string | null | undefined;
}): boolean {
  const route = parseFulfillmentRoute(params.fulfillmentRoute);
  const source = coerceFulfillmentSource(params.fulfillmentSource);
  if (route === 'IN_HOUSE') return true;
  if (route === 'SHOP') return source === 'OUTSOURCE';
  return true;
}

/** Shop pickup offers: SHOP-routed lines (or legacy untagged-route lines with shop tags). */
export function isShopOfferLine(params: {
  fulfillmentRoute: FulfillmentRoute | string | null | undefined;
  hasShopTags: boolean;
}): boolean {
  const route = parseFulfillmentRoute(params.fulfillmentRoute);
  if (route === 'IN_HOUSE') return false;
  if (route === 'SHOP') return params.hasShopTags;
  return params.hasShopTags;
}

export function snapshotFulfillment(params: {
  productSource?: FulfillmentSource | string | null;
  productCost?: number | null;
  variantSource?: FulfillmentSource | string | null;
  variantCost?: number | null;
}): { fulfillmentSource: FulfillmentSource; costPriceSnapshot: number | null } {
  const variantSource = coerceFulfillmentSource(params.variantSource);
  const productSource = coerceFulfillmentSource(params.productSource);
  const fulfillmentSource = variantSource === 'UNSET' ? productSource : variantSource;
  const costPriceSnapshot =
    params.variantCost != null && Number.isFinite(Number(params.variantCost))
      ? roundMoney(Number(params.variantCost))
      : params.productCost != null && Number.isFinite(Number(params.productCost))
        ? roundMoney(Number(params.productCost))
        : null;
  return { fulfillmentSource, costPriceSnapshot };
}
