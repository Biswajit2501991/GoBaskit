import { parseFulfillmentSource } from '@/lib/fulfillmentSource';

export const ADMIN_STOCK_FILTERS = ['all', 'in', 'low', 'out'] as const;
export type AdminStockFilter = (typeof ADMIN_STOCK_FILTERS)[number];

export const ADMIN_SOURCE_FILTERS = ['all', 'IN_HOUSE', 'OUTSOURCE', 'UNSET'] as const;
export type AdminSourceFilter = (typeof ADMIN_SOURCE_FILTERS)[number];

export function parseAdminStockFilter(raw: string | null | undefined): AdminStockFilter {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'in' || value === 'in_stock' || value === 'instock') return 'in';
  if (value === 'low' || value === 'low_stock') return 'low';
  if (value === 'out' || value === 'out_of_stock' || value === 'oos') return 'out';
  return 'all';
}

export function parseAdminSourceFilter(raw: string | null | undefined): AdminSourceFilter {
  const value = String(raw ?? '').trim();
  if (!value || value.toLowerCase() === 'all') return 'all';
  const source = parseFulfillmentSource(value);
  if (source === 'IN_HOUSE' || source === 'OUTSOURCE' || source === 'UNSET') return source;
  return 'all';
}

/** Prisma `where` fragments. Does not touch storefront or stock numbers. */
export function adminListStockWhere(stock: AdminStockFilter): Record<string, unknown> | null {
  if (stock === 'in') return { stock: { gt: 0 } };
  if (stock === 'out') {
    return {
      OR: [{ stock: { lte: 0 } }, { status: 'OUT_OF_STOCK' }],
    };
  }
  return null;
}

export function adminListSourceWhere(source: AdminSourceFilter): Record<string, unknown> | null {
  if (source === 'all') return null;
  return { fulfillmentSource: source };
}
