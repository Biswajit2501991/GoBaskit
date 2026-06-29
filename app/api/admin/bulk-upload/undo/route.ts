import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { undoLastImport } from '@/services/bulk-upload/BulkUploadService';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const batchId = body.batchId as string;
  if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 });

  const result = await undoLastImport(batchId);
  if (result.error) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
