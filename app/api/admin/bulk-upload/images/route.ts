import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { processImageZip } from '@/services/bulk-upload/ImageZipService';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No ZIP file provided' }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const imageMap = await processImageZip(buffer);
  return NextResponse.json({ imageMap, count: Object.keys(imageMap).length });
}
