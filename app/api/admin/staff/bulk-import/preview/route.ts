import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { StaffBulkImportService } from '@/services/bulk-staff-import/StaffBulkImportService';

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('staff:bulk_import', { live: true });
  if (auth.error) return auth.error;

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const rows = StaffBulkImportService.parseBuffer(buffer);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data rows found in file' }, { status: 400 });
  }

  const preview = await StaffBulkImportService.preview(rows);
  return NextResponse.json(preview);
}
