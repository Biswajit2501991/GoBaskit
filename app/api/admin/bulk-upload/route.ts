import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSessionActorLabel } from '@/types/staff';
import { legacyConfirmImport, legacyPreview } from '@/services/bulk-upload/BulkUploadService';

/** Backward-compatible bulk upload endpoint (legacy UI flow). */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const confirm = formData.get('confirm') === 'true';

  if (!confirm) {
    const result = await legacyPreview(buffer);
    return NextResponse.json(result);
  }

  const result = await legacyConfirmImport(buffer, getSessionActorLabel(session));
  return NextResponse.json(result);
}
