import { NextResponse } from 'next/server';
import { requireStaffSession } from '@/lib/staff-auth';
import { NotificationService } from '@/services/NotificationService';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const notification = await NotificationService.markRead(id, auth.staff!.id);
  if (!notification) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
