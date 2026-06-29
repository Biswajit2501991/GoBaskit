import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadHistoryFromSettings } from '@/services/bulk-upload/ImportHistoryStore';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const history = await loadHistoryFromSettings(prisma);
  return NextResponse.json({ history });
}
