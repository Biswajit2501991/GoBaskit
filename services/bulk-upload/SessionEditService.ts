import { prisma } from '@/lib/prisma';
import { loadSession, saveSessionRows } from './ImportHistoryStore';
import {
  buildValidationContext,
  summarizeValidation,
  validateRow,
} from './ValidationService';
import type { ProductTemplateRow, ValidatedRow } from '@/types/BulkUpload';

export async function updateSessionRow(
  sessionId: string,
  rowNumber: number,
  updates: Partial<ProductTemplateRow>,
  autoCreateCategories: boolean
) {
  const session = await loadSession(sessionId);
  const index = session.rows.findIndex((r) => r.row.rowNumber === rowNumber);
  if (index === -1) throw new Error('Row not found');

  const current = session.rows[index];
  const mergedRow: ProductTemplateRow = {
    ...current.row,
    ...updates,
    rowNumber: current.row.rowNumber,
  };
  if (updates.price !== undefined) {
    mergedRow.price = updates.price;
  }

  const categories = await prisma.category.findMany();
  const products = await prisma.product.findMany();
  const ctx = buildValidationContext(categories, products);
  const validated = validateRow(mergedRow, ctx, autoCreateCategories);

  session.rows[index] = validated;
  const summary = summarizeValidation(session.rows);
  session.summary = summary;

  await saveSessionRows(sessionId, session.rows, summary);

  return { row: validated, summary };
}

export async function getValidatedRows(sessionId: string): Promise<ValidatedRow[]> {
  const session = await loadSession(sessionId);
  return session.rows;
}
