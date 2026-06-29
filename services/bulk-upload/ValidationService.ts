import type { Product } from '@prisma/client';
import type {
  ProductTemplateRow,
  ValidatedRow,
  ValidationSummary,
  RowValidationStatus,
} from '@/types/BulkUpload';
import { extractMetadata } from './metadata';

export interface ValidationContext {
  categoryNames: Set<string>;
  productsByName: Map<string, Product>;
  productsByNameCategory: Map<string, Product>;
  productsBySku: Map<string, Product>;
}

export function buildValidationContext(
  categories: { id: string; name: string }[],
  products: Product[]
): ValidationContext {
  const categoryNames = new Set(categories.map((c) => c.name.toLowerCase()));
  const productsByName = new Map<string, Product>();
  const productsByNameCategory = new Map<string, Product>();
  const productsBySku = new Map<string, Product>();

  for (const p of products) {
    productsByName.set(p.name.toLowerCase(), p);
    const meta = extractMetadata(p.description);
    if (meta.sku) productsBySku.set(meta.sku.toLowerCase(), p);
    const cat = categories.find((c) => c.id === p.categoryId);
    if (cat) {
      productsByNameCategory.set(`${p.name.toLowerCase()}::${cat.name.toLowerCase()}`, p);
    }
  }

  return { categoryNames, productsByName, productsByNameCategory, productsBySku };
}

function detectDuplicate(
  row: ProductTemplateRow,
  ctx: ValidationContext
): { isDuplicate: boolean; productId?: string } {
  if (row.sku) {
    const bySku = ctx.productsBySku.get(row.sku.toLowerCase());
    if (bySku) return { isDuplicate: true, productId: bySku.id };
  }
  const nameKey = row.productName.toLowerCase();
  const nameCatKey = `${nameKey}::${row.category.toLowerCase()}`;
  const byNameCat = ctx.productsByNameCategory.get(nameCatKey);
  if (byNameCat) return { isDuplicate: true, productId: byNameCat.id };
  const byName = ctx.productsByName.get(nameKey);
  if (byName) return { isDuplicate: true, productId: byName.id };
  return { isDuplicate: false };
}

export function validateRow(
  row: ProductTemplateRow,
  ctx: ValidationContext,
  autoCreateCategories: boolean
): ValidatedRow {
  const messages: string[] = [];
  let status: RowValidationStatus = 'ready';

  if (!row.productName) {
    messages.push('Missing product name');
    status = 'invalid_row';
  }

  if (!row.category) {
    messages.push('Missing category');
    status = 'missing_category';
  } else {
    const exists = ctx.categoryNames.has(row.category.toLowerCase());
    if (!exists && !autoCreateCategories) {
      messages.push(`Unknown category "${row.category}"`);
      status = 'invalid_category';
    }
  }

  if (row.price === null || row.price <= 0) {
    messages.push('Missing or invalid price');
    if (status === 'ready') status = 'missing_price';
  }

  if (!row.imageUrl) {
    messages.push('No image URL provided');
    if (status === 'ready') status = 'missing_image';
  }

  const dup = detectDuplicate(row, ctx);
  if (dup.isDuplicate) {
    messages.push('Duplicate product detected');
    status = 'duplicate';
  }

  return {
    row,
    status,
    messages,
    duplicateProductId: dup.productId,
    categoryExists: row.category ? ctx.categoryNames.has(row.category.toLowerCase()) : false,
  };
}

export function validateRows(
  rows: ProductTemplateRow[],
  ctx: ValidationContext,
  autoCreateCategories: boolean
): ValidatedRow[] {
  return rows.map((row) => validateRow(row, ctx, autoCreateCategories));
}

export function summarizeValidation(rows: ValidatedRow[]): ValidationSummary {
  const summary: ValidationSummary = {
    valid: 0,
    duplicate: 0,
    invalidCategory: 0,
    missingImage: 0,
    missingPrice: 0,
    invalid: 0,
    total: rows.length,
  };

  for (const r of rows) {
    if (r.status === 'ready') summary.valid++;
    else if (r.status === 'duplicate') summary.duplicate++;
    else if (r.status === 'invalid_category') summary.invalidCategory++;
    else if (r.status === 'missing_image') summary.missingImage++;
    else if (r.status === 'missing_price') summary.missingPrice++;
    else summary.invalid++;
  }

  return summary;
}
