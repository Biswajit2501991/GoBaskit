import * as XLSX from 'xlsx';
import {
  LEGACY_COLUMN_MAP,
  TEMPLATE_COLUMNS,
  type ProductTemplateRow,
} from '@/types/BulkUpload';

function normalizeKey(key: string): string {
  return key.trim();
}

function getCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

function parseBool(val: string, defaultValue = true): boolean {
  if (!val) return defaultValue;
  const v = val.toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(v)) return true;
  if (['false', 'no', '0', 'n'].includes(v)) return false;
  return defaultValue;
}

function parseNumber(val: string): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function mapRow(raw: Record<string, unknown>, rowNumber: number): ProductTemplateRow {
  const mapped: Partial<Record<keyof ProductTemplateRow, string>> = {};

  for (const [header, value] of Object.entries(raw)) {
    const key = LEGACY_COLUMN_MAP[normalizeKey(header)] ?? LEGACY_COLUMN_MAP[header];
    if (key) mapped[key] = String(value ?? '').trim();
  }

  for (const col of TEMPLATE_COLUMNS) {
    const header = col.header;
    if (raw[header] !== undefined && raw[header] !== null) {
      mapped[col.key as keyof ProductTemplateRow] = String(raw[header]).trim();
    }
  }

  const price = parseNumber(mapped.price ?? getCell(raw, 'Price', 'price'));
  const salePrice = parseNumber(mapped.salePrice ?? getCell(raw, 'Sale Price', 'salePrice'));
  const stock = parseInt(String((mapped.stock ?? getCell(raw, 'Stock', 'Stock Quantity', 'stock')) || '0'), 10);

  return {
    rowNumber,
    productName: mapped.productName ?? getCell(raw, 'Product Name', 'name'),
    category: mapped.category ?? getCell(raw, 'Category', 'category'),
    subCategory: mapped.subCategory ?? getCell(raw, 'Sub Category', 'subCategory'),
    price,
    salePrice,
    unit: (mapped.unit ?? getCell(raw, 'Unit', 'unit')) || '1 pc',
    stock: Number.isFinite(stock) ? stock : 0,
    sku: mapped.sku ?? getCell(raw, 'SKU', 'sku'),
    description: mapped.description ?? getCell(raw, 'Description', 'Product Description', 'description'),
    imageUrl: mapped.imageUrl ?? getCell(raw, 'Image URL', 'Product Image URL', 'image_url'),
    featured: parseBool(mapped.featured ?? getCell(raw, 'Featured', 'featured'), false),
    active: parseBool(mapped.active ?? getCell(raw, 'Active', 'active'), true),
    sortOrder: parseInt(String((mapped.sortOrder ?? getCell(raw, 'Sort Order', 'sortOrder')) || '0'), 10) || 0,
    gstPercent: parseNumber(mapped.gstPercent ?? getCell(raw, 'GST %', 'GST', 'gstPercent')),
    weight: mapped.weight ?? getCell(raw, 'Weight', 'weight'),
    tags: mapped.tags ?? getCell(raw, 'Tags', 'tags'),
    brand: mapped.brand ?? getCell(raw, 'Brand', 'brand'),
    countryOfOrigin: mapped.countryOfOrigin ?? getCell(raw, 'Country of Origin', 'countryOfOrigin'),
  };
}

export function parseSpreadsheetBuffer(buffer: ArrayBuffer): ProductTemplateRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === 'products') ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return rows
    .map((row, i) => mapRow(row, i + 2))
    .filter((row) => row.productName || row.category || row.price);
}

export function parseSpreadsheetFile(file: File): Promise<ProductTemplateRow[]> {
  return file.arrayBuffer().then(parseSpreadsheetBuffer);
}
