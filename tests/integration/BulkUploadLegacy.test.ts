import { legacyPreview } from '@/services/bulk-upload/BulkUploadService';
import * as XLSX from 'xlsx';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    category: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Vegetables' }]) },
    product: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

describe('Bulk upload legacy preview', () => {
  it('returns preview compatible with legacy API shape', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Product Name', 'Category', 'Price', 'Unit', 'Stock'],
      ['Carrot', 'Vegetables', '35', '1 kg', '20'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const result = await legacyPreview(buffer);
    expect(result.requiresConfirm).toBe(true);
    expect(result.success).toBe(1);
    expect(result.preview[0]).toMatchObject({
      name: 'Carrot',
      categoryName: 'Vegetables',
      price: 35,
    });
  });
});
