import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSessionPage } from '@/services/bulk-upload/ImportHistoryStore';
import { updateSessionRow } from '@/services/bulk-upload/SessionEditService';
import type { ProductTemplateRow } from '@/types/BulkUpload';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '50', 10);

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  try {
    const data = await getSessionPage(sessionId, page, pageSize);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const sessionId = body.sessionId as string;
  const rowNumber = Number(body.rowNumber);
  const updates = body.updates as Partial<ProductTemplateRow>;
  const autoCreateCategories = body.autoCreateCategories !== false;

  if (!sessionId || !rowNumber) {
    return NextResponse.json({ error: 'sessionId and rowNumber required' }, { status: 400 });
  }

  try {
    const result = await updateSessionRow(sessionId, rowNumber, updates, autoCreateCategories);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update row' },
      { status: 400 }
    );
  }
}
