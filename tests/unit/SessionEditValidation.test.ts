import { buildValidationContext, validateRow } from '@/services/bulk-upload/ValidationService';
import type { ProductTemplateRow } from '@/types/BulkUpload';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    category: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
  },
}));

describe('Session row edit validation', () => {
  const ctx = buildValidationContext(
    [{ id: 'c1', name: 'Vegetables' }],
    []
  );

  it('re-validates row after price fix', () => {
    const row: ProductTemplateRow = {
      rowNumber: 2,
      productName: 'Spinach',
      category: 'Vegetables',
      subCategory: '',
      price: null,
      salePrice: null,
      unit: '1 bunch',
      stock: 10,
      sku: '',
      description: '',
      imageUrl: '',
      featured: false,
      active: true,
      sortOrder: 0,
      gstPercent: null,
      weight: '',
      tags: '',
      brand: '',
      countryOfOrigin: '',
    };
    const invalid = validateRow(row, ctx, true);
    expect(invalid.status).toBe('missing_price');

    const fixed = validateRow({ ...row, price: 25, imageUrl: 'https://example.com/spinach.jpg' }, ctx, true);
    expect(fixed.status).toBe('ready');
  });
});
