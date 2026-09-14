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
