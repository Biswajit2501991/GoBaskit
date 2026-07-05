import * as XLSX from 'xlsx';
import { STAFF_ROLES } from '@/types/staff';
import { STAFF_TEMPLATE_COLUMNS } from '@/types/StaffBulkImport';

export function buildStaffTemplateWorkbook() {
  const headers = STAFF_TEMPLATE_COLUMNS.map((c) => c.header);
  const descriptions = STAFF_TEMPLATE_COLUMNS.map((c) => c.description);
  const required = STAFF_TEMPLATE_COLUMNS.map((c) => (c.required ? 'Required' : 'Optional'));
  const samples = STAFF_TEMPLATE_COLUMNS.map((c) => c.sample);

  const staffSheet = XLSX.utils.aoa_to_sheet([headers, descriptions, required, samples]);
  staffSheet['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  const instructions = [
    ['GoBaskit Staff Bulk Import Template'],
    [''],
    ['How to use:'],
    ['1. Fill the Staff sheet starting from row 5.'],
    ['2. Mobile must be a unique 10-digit Indian number.'],
    ['3. Role must match one of the allowed values on the Roles sheet.'],
    ['4. Import via Admin → Staff → Bulk Import.'],
    [''],
    ['Allowed roles:'],
    ...STAFF_ROLES.map((r) => [r]),
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
  const rolesSheet = XLSX.utils.aoa_to_sheet([['Role'], ...STAFF_ROLES.map((r) => [r])]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, staffSheet, 'Staff');
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
  XLSX.utils.book_append_sheet(workbook, rolesSheet, 'Roles');
  return workbook;
}

export function generateStaffXlsxBuffer(): Buffer {
  const workbook = buildStaffTemplateWorkbook();
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

export function generateStaffCsvContent(): string {
  const workbook = buildStaffTemplateWorkbook();
  const sheet = workbook.Sheets.Staff;
  return XLSX.utils.sheet_to_csv(sheet);
}
