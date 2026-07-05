import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getSessionActorLabel } from '@/types/staff';
import { importChunk } from '@/services/bulk-upload/BulkUploadService';
import type { DuplicateStrategy } from '@/types/BulkUpload';

const CHUNK_SIZE = 50;

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const sessionId = body.sessionId as string;
  const start = Number(body.start ?? 0);
  const end = Number(body.end ?? start + CHUNK_SIZE);
  const duplicateStrategy = (body.duplicateStrategy as DuplicateStrategy) || 'skip';
  const autoCreateCategories = body.autoCreateCategories !== false;
  const imageMap = (body.imageMap as Record<string, string>) || {};

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const result = await importChunk({
    sessionId,
    start,
    end,
    duplicateStrategy,
    autoCreateCategories,
    adminEmail: getSessionActorLabel(session),
    imageMap,
  });

  return NextResponse.json(result);
}
