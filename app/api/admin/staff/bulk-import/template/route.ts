import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { generateStaffCsvContent, generateStaffXlsxBuffer } from '@/services/bulk-staff-import/StaffTemplateService';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('staff:bulk_import');
  if (auth.error) return auth.error;

  const format = req.nextUrl.searchParams.get('format') || 'xlsx';

  if (format === 'csv') {
    const csv = generateStaffCsvContent();
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="gobaskit-staff-template.csv"',
      },
    });
  }

  const buffer = generateStaffXlsxBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="gobaskit-staff-template.xlsx"',
    },
  });
}
