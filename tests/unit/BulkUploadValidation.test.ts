import { buildValidationContext, summarizeValidation, validateRows } from '@/services/bulk-upload/ValidationService';
import type { ProductTemplateRow } from '@/types/BulkUpload';

describe('BulkUploadValidation', () => {
  const categories = [
    { id: 'cat-1', name: 'Vegetables' },
    { id: 'cat-2', name: 'Fruits' },
  ];

  const products = [
    {
      id: 'p-1',
      name: 'Tomato',
      description: '\n\n---\nMETA:{"sku":"VEG-001"}',
      price: 40,
      unit: '1 kg',
      stock: 10,
      status: 'ACTIVE',
      imageUrl: null,
      discount: 0,
      isFeatured: false,
      isVisible: true,
      categoryId: 'cat-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as const;

  const ctx = buildValidationContext(categories, products as never);

  it('marks valid row as ready', () => {
    const row: ProductTemplateRow = {
      rowNumber: 2,
      productName: 'Potato',
      category: 'Vegetables',
      subCategory: '',
      price: 30,
      salePrice: null,
      unit: '1 kg',
      stock: 20,
      sku: 'VEG-002',
      description: '',
      imageUrl: 'https://example.com/potato.jpg',
      featured: false,
      active: true,
      sortOrder: 0,
      gstPercent: 5,
      weight: '1 kg',
      tags: '',
      brand: '',
      countryOfOrigin: 'India',
    };
    const [validated] = validateRows([row], ctx, true);
    expect(validated.status).toBe('ready');
  });

  it('detects duplicate by SKU', () => {
    const row: ProductTemplateRow = {
      rowNumber: 3,
      productName: 'New Tomato',
      category: 'Vegetables',
      subCategory: '',
      price: 45,
      salePrice: null,
      unit: '1 kg',
      stock: 5,
      sku: 'VEG-001',
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
    const [validated] = validateRows([row], ctx, true);
    expect(validated.status).toBe('duplicate');
  });

  it('flags unknown category when auto-create disabled', () => {
    const row: ProductTemplateRow = {
      rowNumber: 4,
      productName: 'Quinoa',
      category: 'Organic Foods',
      subCategory: '',
      price: 200,
      salePrice: null,
      unit: '500 g',
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
    const [validated] = validateRows([row], ctx, false);
    expect(validated.status).toBe('invalid_category');
  });

  it('summarizes validation counts', () => {
    const rows: ProductTemplateRow[] = [
      {
        rowNumber: 2,
        productName: 'Potato',
        category: 'Vegetables',
        subCategory: '',
        price: 30,
        salePrice: null,
        unit: '1 kg',
        stock: 20,
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
      },
      {
        rowNumber: 3,
        productName: '',
        category: 'Vegetables',
        subCategory: '',
        price: null,
        salePrice: null,
        unit: '1 pc',
        stock: 0,
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
      },
    ];
    const validated = validateRows(rows, ctx, true);
    const summary = summarizeValidation(validated);
    expect(summary.total).toBe(2);
    expect(summary.missingImage).toBeGreaterThanOrEqual(1);
  });
});
