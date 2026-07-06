import {
  isLowStock,
  lowStockThreshold,
  nextStockBaseline,
  resolveProductStatus,
} from '@/utils/inventory';

describe('inventory utils', () => {
  it('calculates 25% low stock threshold', () => {
    expect(lowStockThreshold(100)).toBe(25);
    expect(lowStockThreshold(10)).toBe(3);
    expect(lowStockThreshold(0)).toBe(0);
  });

  it('detects low stock', () => {
    expect(isLowStock(25, 100)).toBe(true);
    expect(isLowStock(26, 100)).toBe(false);
    expect(isLowStock(0, 100)).toBe(false);
  });

  it('resolves product status from stock', () => {
    expect(resolveProductStatus(0, 'ACTIVE')).toBe('OUT_OF_STOCK');
    expect(resolveProductStatus(5, 'ACTIVE')).toBe('ACTIVE');
    expect(resolveProductStatus(5, 'INACTIVE')).toBe('INACTIVE');
    expect(resolveProductStatus(0, 'INACTIVE')).toBe('INACTIVE');
  });

  it('raises stock baseline on restock', () => {
    expect(nextStockBaseline(100, 80)).toBe(100);
    expect(nextStockBaseline(100, 150)).toBe(150);
  });
});
