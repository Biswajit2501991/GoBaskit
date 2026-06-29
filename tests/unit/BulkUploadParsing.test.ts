import { parseSpreadsheetBuffer } from '@/services/bulk-upload/parseSpreadsheet';
import * as XLSX from 'xlsx';

describe('parseSpreadsheet', () => {
  it('parses legacy column headers', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Product Name', 'Category', 'Price', 'Unit', 'Stock', 'Image URL', 'Description'],
      ['Onion', 'Vegetables', '25', '1 kg', '100', 'https://example.com/onion.jpg', 'Red onion'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Products');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const rows = parseSpreadsheetBuffer(buffer);
    expect(rows).toHaveLength(1);
    expect(rows[0].productName).toBe('Onion');
    expect(rows[0].category).toBe('Vegetables');
    expect(rows[0].price).toBe(25);
    expect(rows[0].imageUrl).toBe('https://example.com/onion.jpg');
  });

  it('parses extended template columns', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Product Name', 'Category', 'Sub Category', 'Price', 'Sale Price', 'Unit', 'Stock Quantity', 'SKU', 'Featured', 'Active'],
      ['Milk', 'Dairy', 'Organic', '60', '55', '1 L', '40', 'DAI-001', 'TRUE', 'TRUE'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Products');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    const rows = parseSpreadsheetBuffer(buffer);
    expect(rows[0].sku).toBe('DAI-001');
    expect(rows[0].salePrice).toBe(55);
    expect(rows[0].featured).toBe(true);
    expect(rows[0].subCategory).toBe('Organic');
  });
});
