import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { validateUpload } from '@/services/bulk-upload/BulkUploadService';
import { cleanupExpiredSessions } from '@/services/bulk-upload/ImportHistoryStore';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await cleanupExpiredSessions();

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const autoCreateCategories = formData.get('autoCreateCategories') !== 'false';
  const buffer = await file.arrayBuffer();

  const result = await validateUpload(buffer, file.name, session.email, autoCreateCategories);
  return NextResponse.json(result);
}
