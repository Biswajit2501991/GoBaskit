import { NextRequest, NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/staff-auth';
import { NotificationService } from '@/services/NotificationService';

export async function GET(req: NextRequest) {
  const auth = await requireStaffSession();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const data = await NotificationService.list(auth.staff!.id, {
    page: Number(searchParams.get('page') || 1),
    pageSize: Number(searchParams.get('pageSize') || 20),
    unreadOnly: searchParams.get('unreadOnly') === 'true',
    readState: (searchParams.get('readState') as 'all' | 'read' | 'unread' | null) || 'all',
    type: searchParams.get('type') || undefined,
  });

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffSession();
  if (auth.error) return auth.error;

  const body = await req.json();
  if (body.markAllRead) {
    await NotificationService.markAllRead(auth.staff!.id);
    return NextResponse.json({ ok: true });
  }

  if (body.markTypeRead && typeof body.markTypeRead === 'string') {
    await NotificationService.markByTypeRead(auth.staff!.id, body.markTypeRead);
    return NextResponse.json({ ok: true });
  }

  if (body.clearAll) {
    await NotificationService.deleteAll(auth.staff!.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

export async function DELETE() {
  const auth = await requireStaffSession();
  if (auth.error) return auth.error;
  await NotificationService.deleteAll(auth.staff!.id);
  return NextResponse.json({ ok: true });
}
