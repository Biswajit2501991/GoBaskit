import * as XLSX from 'xlsx';
import {
  STAFF_COLUMN_MAP,
  STAFF_TEMPLATE_COLUMNS,
  type StaffTemplateRow,
} from '@/types/StaffBulkImport';

function getCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
}

function mapRow(raw: Record<string, unknown>, rowNumber: number): StaffTemplateRow {
  const mapped: Partial<Record<keyof StaffTemplateRow, string>> = {};

  for (const [header, value] of Object.entries(raw)) {
    const key = STAFF_COLUMN_MAP[header.trim()] ?? STAFF_COLUMN_MAP[header];
    if (key) mapped[key] = String(value ?? '').trim();
  }

  for (const col of STAFF_TEMPLATE_COLUMNS) {
    if (raw[col.header] !== undefined && raw[col.header] !== null) {
      mapped[col.key] = String(raw[col.header]).trim();
    }
  }

  return {
    rowNumber,
    name: mapped.name ?? getCell(raw, 'Name', 'name'),
    mobile: mapped.mobile ?? getCell(raw, 'Mobile', 'mobile'),
    email: mapped.email ?? getCell(raw, 'Email', 'email'),
    role: mapped.role ?? getCell(raw, 'Role', 'role'),
    password: mapped.password ?? getCell(raw, 'Password', 'password'),
    active: mapped.active ?? getCell(raw, 'Active', 'active'),
  };
}

export function parseStaffSpreadsheetBuffer(buffer: ArrayBuffer): StaffTemplateRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === 'staff') ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  return rows
    .map((row, i) => mapRow(row, i + 2))
    .filter((row) => row.name || row.mobile || row.role);
}
