export const LOW_STOCK_RATIO = 0.25;

export function lowStockThreshold(baseline: number): number {
  if (baseline <= 0) return 0;
  return Math.max(1, Math.ceil(baseline * LOW_STOCK_RATIO));
}

export function isLowStock(stock: number, baseline: number): boolean {
  if (baseline <= 0 || stock <= 0) return false;
  return stock <= lowStockThreshold(baseline);
}

export function resolveProductStatus(
  stock: number,
  currentStatus: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK',
): 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK' {
  if (currentStatus === 'INACTIVE') return 'INACTIVE';
  if (stock <= 0) return 'OUT_OF_STOCK';
  return 'ACTIVE';
}

export function nextStockBaseline(currentBaseline: number, newStock: number): number {
  return Math.max(currentBaseline, newStock);
}
