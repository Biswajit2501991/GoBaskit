import { ProductStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import type {
  DuplicateStrategy,
  ImportResult,
  ProductTemplateRow,
  ValidatedRow,
} from '@/types/BulkUpload';
import { CategoryResolver } from './CategoryResolver';
import { embedMetadata } from './metadata';
import { resolveImageUrl } from './ImageZipService';
import {
  buildValidationContext,
  summarizeValidation,
  validateRows,
} from './ValidationService';
import { parseSpreadsheetBuffer } from './parseSpreadsheet';
import {
  createBatchRecord,
  saveHistoryBatch,
  saveSession,
} from './ImportHistoryStore';

export interface LegacyPreviewResult {
  preview: { name: string; categoryName: string; price: number; unit: string; stock: number }[];
  success: number;
  errors: string[];
  requiresConfirm: true;
}

export interface EnhancedValidateResult {
  sessionId: string;
  summary: ReturnType<typeof summarizeValidation>;
  rows: ValidatedRow[];
  requiresConfirm: true;
}

function rowToProductData(
  row: ProductTemplateRow,
  categoryId: string,
  imageMap: Record<string, string>
) {
  const discount =
    row.salePrice && row.price && row.salePrice < row.price
      ? Math.round(((row.price - row.salePrice) / row.price) * 100)
      : 0;

  const description = embedMetadata(row.description, {
    sku: row.sku || undefined,
    subCategory: row.subCategory || undefined,
    sortOrder: row.sortOrder,
    gstPercent: row.gstPercent,
    weight: row.weight || undefined,
    tags: row.tags || undefined,
    brand: row.brand || undefined,
    countryOfOrigin: row.countryOfOrigin || undefined,
  });

  const imageUrl = row.imageUrl
    ? resolveImageUrl(row.imageUrl, imageMap, row.sku, row.productName)
    : null;

  const status: ProductStatus = !row.active
    ? ProductStatus.INACTIVE
    : row.stock <= 0
      ? ProductStatus.OUT_OF_STOCK
      : ProductStatus.ACTIVE;

  return {
    name: row.productName,
    description,
    price: row.price ?? 0,
    unit: row.unit,
    stock: row.stock,
    categoryId,
    status,
    imageUrl: imageUrl || null,
    discount,
    isFeatured: row.featured,
    isVisible: row.active,
  };
}

export async function legacyPreview(buffer: ArrayBuffer): Promise<LegacyPreviewResult> {
  const rows = parseSpreadsheetBuffer(buffer);
  const categories = await prisma.category.findMany();
  const products = await prisma.product.findMany();
  const ctx = buildValidationContext(categories, products);
  const validated = validateRows(rows, ctx, true);

  const preview: LegacyPreviewResult['preview'] = [];
  const errors: string[] = [];
  let success = 0;

  for (const v of validated) {
    if (v.status === 'ready' || v.status === 'missing_image') {
      preview.push({
        name: v.row.productName,
        categoryName: v.row.category,
        price: v.row.price ?? 0,
        unit: v.row.unit,
        stock: v.row.stock,
      });
      success++;
    } else if (v.status === 'duplicate') {
      errors.push(`Row ${v.row.rowNumber}: Duplicate product "${v.row.productName}" — skipped`);
    } else {
      errors.push(`Row ${v.row.rowNumber}: ${v.messages.join(', ')}`);
    }
  }

  return { preview, success, errors, requiresConfirm: true };
}

export async function legacyConfirmImport(
  buffer: ArrayBuffer,
  adminEmail: string
): Promise<{ imported: number; errors: string[] }> {
  const { errors } = await legacyPreview(buffer);
  const categories = await prisma.category.findMany();
  const products = await prisma.product.findMany();
  const ctx = buildValidationContext(categories, products);
  const validated = validateRows(parseSpreadsheetBuffer(buffer), ctx, true);
  const resolver = new CategoryResolver(categories);
  let imported = 0;
  const productIds: string[] = [];

  for (const v of validated) {
    if (v.status === 'duplicate' || v.status === 'missing_price' || !v.row.productName) continue;

    const categoryId = await resolver.resolve(v.row.category, true);
    if (!categoryId) continue;

    const data = rowToProductData(v.row, categoryId, {});
    const product = await prisma.product.create({ data });
    productIds.push(product.id);
    imported++;
  }

  await saveHistoryBatch(
    prisma,
    createBatchRecord(adminEmail, 'legacy-import', productIds, resolver.createdCategoryIds, {
      imported,
      updated: 0,
      skipped: validated.length - imported,
      failed: 0,
      errors,
    })
  );

  revalidateStore();
  return { imported, errors };
}

export async function validateUpload(
  buffer: ArrayBuffer,
  filename: string,
  adminEmail: string,
  autoCreateCategories: boolean
): Promise<EnhancedValidateResult> {
  const rows = parseSpreadsheetBuffer(buffer);
  const categories = await prisma.category.findMany();
  const products = await prisma.product.findMany();
  const ctx = buildValidationContext(categories, products);
  const validated = validateRows(rows, ctx, autoCreateCategories);
  const summary = summarizeValidation(validated);

  const sessionId = await saveSession(validated, {
    filename,
    adminEmail,
    rowCount: rows.length,
    summary,
  });

  return {
    sessionId,
    summary,
    rows: validated.slice(0, 100),
    requiresConfirm: true,
  };
}

export async function importChunk(options: {
  sessionId: string;
  start: number;
  end: number;
  duplicateStrategy: DuplicateStrategy;
  autoCreateCategories: boolean;
  adminEmail: string;
  imageMap?: Record<string, string>;
}): Promise<ImportResult & { processed: number; total: number }> {
  const { loadSession, deleteSession } = await import('./ImportHistoryStore');
  const session = await loadSession(options.sessionId);
  const slice = session.rows.slice(options.start, options.end);

  const categories = await prisma.category.findMany();
  const resolver = new CategoryResolver(categories);
  const imageMap = options.imageMap ?? {};

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];
  const productIds: string[] = [];

  for (const v of slice) {
    try {
      if (options.duplicateStrategy === 'cancel' && v.status === 'duplicate') {
        skipped++;
        errors.push(`Row ${v.row.rowNumber}: Duplicate — cancelled`);
        continue;
      }

      if (v.status !== 'ready' && v.status !== 'missing_image' && v.status !== 'duplicate') {
        failed++;
        errors.push(`Row ${v.row.rowNumber}: ${v.messages.join(', ')}`);
        continue;
      }

      const categoryId = await resolver.resolve(v.row.category, options.autoCreateCategories);
      if (!categoryId) {
        failed++;
        errors.push(`Row ${v.row.rowNumber}: Category "${v.row.category}" not found`);
        continue;
      }

      const data = rowToProductData(v.row, categoryId, imageMap);

      if (v.status === 'duplicate' && v.duplicateProductId) {
        if (options.duplicateStrategy === 'skip') {
          skipped++;
          continue;
        }
        if (options.duplicateStrategy === 'update' || options.duplicateStrategy === 'replace') {
          await prisma.product.update({ where: { id: v.duplicateProductId }, data });
          productIds.push(v.duplicateProductId);
          updated++;
          continue;
        }
      }

      const product = await prisma.product.create({ data });
      productIds.push(product.id);
      imported++;
    } catch (e) {
      failed++;
      errors.push(`Row ${v.row.rowNumber}: ${e instanceof Error ? e.message : 'Import failed'}`);
    }
  }

  const isLastChunk = options.end >= session.rows.length;
  let batchId: string | undefined;

  const { updateSessionImportProgress } = await import('./ImportHistoryStore');
  const accumulated = await updateSessionImportProgress(options.sessionId, {
    productIds,
    createdCategoryIds: resolver.createdCategoryIds,
    imported,
    updated,
    skipped,
    failed,
    errors,
  });

  if (isLastChunk) {
    const batch = createBatchRecord(options.adminEmail, session.filename, accumulated.productIds, accumulated.createdCategoryIds, {
      imported: accumulated.imported,
      updated: accumulated.updated,
      skipped: accumulated.skipped,
      failed: accumulated.failed,
      errors: accumulated.errors,
    });
    await saveHistoryBatch(prisma, batch);
    batchId = batch.id;
    revalidateStore();
    await deleteSession(options.sessionId);
  }

  return {
    imported,
    updated,
    skipped,
    failed,
    errors,
    batchId,
    processed: options.end,
    total: session.rows.length,
  };
}

export async function undoLastImport(batchId: string): Promise<{ undone: number; error?: string }> {
  const { loadHistoryFromSettings, canUndoBatch } = await import('./ImportHistoryStore');
  const history = await loadHistoryFromSettings(prisma);
  const batch = history.find((b) => b.id === batchId);
  if (!batch) return { undone: 0, error: 'Import batch not found' };
  if (!canUndoBatch(batch)) return { undone: 0, error: 'Undo window expired' };

  await prisma.product.deleteMany({ where: { id: { in: batch.productIds } } });

  if (batch.createdCategoryIds.length) {
    for (const catId of batch.createdCategoryIds) {
      const count = await prisma.product.count({ where: { categoryId: catId } });
      if (count === 0) {
        await prisma.category.delete({ where: { id: catId } }).catch(() => null);
      }
    }
  }

  revalidateStore();
  return { undone: batch.productIds.length };
}

function revalidateStore() {
  revalidatePath('/');
  revalidatePath('/cart');
  revalidatePath('/checkout');
  revalidatePath('/category/[slug]', 'page');
  revalidatePath('/product/[id]', 'page');
  revalidatePath('/admin/products');
  revalidatePath('/admin/categories');
}

export { revalidateStore };
