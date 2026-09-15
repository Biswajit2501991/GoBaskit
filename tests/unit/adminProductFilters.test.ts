import {
  adminListSourceWhere,
  adminListStockWhere,
  parseAdminSourceFilter,
  parseAdminStockFilter,
} from '@/lib/adminProductFilters';

describe('admin product list filters', () => {
  it('parses stock and source query values', () => {
    expect(parseAdminStockFilter(null)).toBe('all');
    expect(parseAdminStockFilter('out')).toBe('out');
    expect(parseAdminStockFilter('OUT_OF_STOCK')).toBe('out');
    expect(parseAdminStockFilter('low')).toBe('low');
    expect(parseAdminSourceFilter('outsource')).toBe('OUTSOURCE');
    expect(parseAdminSourceFilter('in house')).toBe('IN_HOUSE');
    expect(parseAdminSourceFilter('')).toBe('all');
  });

  it('builds stock/source where without changing other fields', () => {
    expect(adminListStockWhere('all')).toBeNull();
    expect(adminListStockWhere('in')).toEqual({ stock: { gt: 0 } });
    expect(adminListStockWhere('out')).toEqual({
      OR: [{ stock: { lte: 0 } }, { status: 'OUT_OF_STOCK' }],
    });
    expect(adminListSourceWhere('OUTSOURCE')).toEqual({ fulfillmentSource: 'OUTSOURCE' });
    expect(adminListSourceWhere('all')).toBeNull();
  });
});
