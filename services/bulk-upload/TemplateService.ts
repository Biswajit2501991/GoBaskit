import * as XLSX from 'xlsx';
import { TEMPLATE_COLUMNS } from '@/types/BulkUpload';

export interface TemplateCategory {
  name: string;
}

export function buildTemplateWorkbook(categories: TemplateCategory[]) {
  const headers = TEMPLATE_COLUMNS.map((c) => c.header);
  const descriptions = TEMPLATE_COLUMNS.map((c) => c.description);
  const samples = TEMPLATE_COLUMNS.map((c) => c.sample);
  const required = TEMPLATE_COLUMNS.map((c) => (c.required ? 'Required' : 'Optional'));

  const sampleRows = [
    samples,
    TEMPLATE_COLUMNS.map((c) => {
      if (c.key === 'productName') return 'Onion';
      if (c.key === 'category') return categories[0]?.name ?? 'Vegetables';
      if (c.key === 'price') return '30';
      if (c.key === 'unit') return '1 kg';
      if (c.key === 'stock') return '100';
      return c.sample;
    }),
    TEMPLATE_COLUMNS.map((c) => {
      if (c.key === 'productName') return 'Amul Milk';
      if (c.key === 'category') return categories.find((x) => /dairy/i.test(x.name))?.name ?? 'Dairy';
      if (c.key === 'price') return '60';
      if (c.key === 'unit') return '1 L';
      if (c.key === 'stock') return '40';
      return '';
    }),
  ];

  const productsSheet = XLSX.utils.aoa_to_sheet([
    headers,
    descriptions,
    required,
    ...sampleRows,
  ]);

  productsSheet['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  const instructions = [
    ['GoBaskit Bulk Product Upload Template'],
    [''],
    ['How to use:'],
    ['1. Fill the Products sheet starting from row 5 (sample rows are examples).'],
    ['2. Required columns are marked in row 3.'],
    ['3. Category must match an existing category or enable Auto Create in admin.'],
    ['4. Featured / Active accept TRUE or FALSE.'],
    ['5. Import via Admin → Bulk Upload. Compatible with Excel, CSV, and Google Sheets.'],
    [''],
    ['Column reference:'],
    ...TEMPLATE_COLUMNS.map((c) => [c.header, c.required ? 'Required' : 'Optional', c.description, `Example: ${c.sample}`]),
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);

  const categoryRows = [['Category Name'], ...categories.map((c) => [c.name])];
  const categoriesSheet = XLSX.utils.aoa_to_sheet(categoryRows);

  const validations = [
    ['Field', 'Validation'],
    ...TEMPLATE_COLUMNS.map((c) => [c.header, c.description]),
    ['Featured / Active', 'TRUE or FALSE'],
    ['Price / Sale Price', 'Positive number in INR'],
    ['Stock Quantity', 'Non-negative integer'],
  ];
  const validationSheet = XLSX.utils.aoa_to_sheet(validations);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, productsSheet, 'Products');
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
  XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Categories');
  XLSX.utils.book_append_sheet(workbook, validationSheet, 'Validation');

  return workbook;
}

export function generateXlsxBuffer(categories: TemplateCategory[]): Buffer {
  const workbook = buildTemplateWorkbook(categories);
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

export function generateCsvContent(categories: TemplateCategory[]): string {
  const workbook = buildTemplateWorkbook(categories);
  const sheet = workbook.Sheets.Products;
  return XLSX.utils.sheet_to_csv(sheet);
}

export const GOOGLE_SHEETS_HELP_URL = 'https://docs.google.com/spreadsheets/create';
