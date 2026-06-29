export type DuplicateStrategy = 'skip' | 'update' | 'replace' | 'cancel';

export type RowValidationStatus =
  | 'ready'
  | 'duplicate'
  | 'missing_price'
  | 'missing_category'
  | 'missing_image'
  | 'invalid_category'
  | 'invalid_row';

export interface ProductTemplateRow {
  rowNumber: number;
  productName: string;
  category: string;
  subCategory: string;
  price: number | null;
  salePrice: number | null;
  unit: string;
  stock: number;
  sku: string;
  description: string;
  imageUrl: string;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  gstPercent: number | null;
  weight: string;
  tags: string;
  brand: string;
  countryOfOrigin: string;
}

export interface ValidatedRow {
  row: ProductTemplateRow;
  status: RowValidationStatus;
  messages: string[];
  duplicateProductId?: string;
  resolvedCategoryId?: string;
  categoryExists: boolean;
}

export interface ValidationSummary {
  valid: number;
  duplicate: number;
  invalidCategory: number;
  missingImage: number;
  missingPrice: number;
  invalid: number;
  total: number;
}

export interface ImportSessionMeta {
  id: string;
  createdAt: string;
  filename: string;
  adminEmail: string;
  rowCount: number;
  summary: ValidationSummary;
}

export interface ImportBatchRecord {
  id: string;
  createdAt: string;
  adminEmail: string;
  filename: string;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  productIds: string[];
  createdCategoryIds: string[];
  expiresAt: string;
  errors: string[];
}

export interface ImportProgress {
  processed: number;
  total: number;
  percent: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  done: boolean;
}

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
  batchId?: string;
}

export const TEMPLATE_COLUMNS = [
  { key: 'productName', header: 'Product Name', required: true, sample: 'Fresh Tomato', description: 'Unique product display name' },
  { key: 'category', header: 'Category', required: true, sample: 'Vegetables', description: 'Must match existing category or will be created if enabled' },
  { key: 'subCategory', header: 'Sub Category', required: false, sample: 'Organic', description: 'Optional sub-category label' },
  { key: 'price', header: 'Price', required: true, sample: '45', description: 'MRP in INR' },
  { key: 'salePrice', header: 'Sale Price', required: false, sample: '40', description: 'Selling price — discount auto-calculated if lower than Price' },
  { key: 'unit', header: 'Unit', required: true, sample: '1 kg', description: 'e.g. 500 g, 1 L, 6 pcs' },
  { key: 'stock', header: 'Stock Quantity', required: true, sample: '50', description: 'Available inventory count' },
  { key: 'sku', header: 'SKU', required: false, sample: 'VEG-TOM-001', description: 'Stock keeping unit for duplicate detection' },
  { key: 'description', header: 'Product Description', required: false, sample: 'Farm fresh red tomatoes', description: 'Customer-facing description' },
  { key: 'imageUrl', header: 'Product Image URL', required: false, sample: 'https://example.com/tomato.jpg', description: 'Image URL or filename matching ZIP upload' },
  { key: 'featured', header: 'Featured', required: false, sample: 'TRUE', description: 'TRUE or FALSE — shows Best Seller badge' },
  { key: 'active', header: 'Active', required: false, sample: 'TRUE', description: 'TRUE or FALSE — visible on store' },
  { key: 'sortOrder', header: 'Sort Order', required: false, sample: '1', description: 'Display order hint (stored in metadata)' },
  { key: 'gstPercent', header: 'GST %', required: false, sample: '5', description: 'GST percentage' },
  { key: 'weight', header: 'Weight', required: false, sample: '1 kg', description: 'Shipping weight' },
  { key: 'tags', header: 'Tags', required: false, sample: 'organic,fresh', description: 'Comma-separated tags' },
  { key: 'brand', header: 'Brand', required: false, sample: 'GoBaskit Farms', description: 'Product brand' },
  { key: 'countryOfOrigin', header: 'Country of Origin', required: false, sample: 'India', description: 'Country of origin' },
] as const;

// Legacy column aliases (backward compatible)
export const LEGACY_COLUMN_MAP: Record<string, keyof ProductTemplateRow> = {
  'Product Name': 'productName',
  name: 'productName',
  Category: 'category',
  category: 'category',
  Price: 'price',
  price: 'price',
  Unit: 'unit',
  unit: 'unit',
  Stock: 'stock',
  'Stock Quantity': 'stock',
  stock: 'stock',
  Description: 'description',
  'Product Description': 'description',
  description: 'description',
  'Image URL': 'imageUrl',
  'Product Image URL': 'imageUrl',
  image_url: 'imageUrl',
};
