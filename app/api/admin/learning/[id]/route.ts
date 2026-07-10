import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningNoteSchema, formatZodFlattenError } from '@/lib/validations';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';

type RouteContext = { params: Promise<{ id: string }> };

const noteInclude = {
  author: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
} as const;

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('learning:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = learningNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodFlattenError(parsed.error.flatten()) },
      { status: 400 },
    );
  }

  const existing = await prisma.learningNote.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

  const note = await prisma.learningNote.update({
    where: { id },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      updatedById: auth.staff?.id ?? null,
    },
    include: noteInclude,
  });

  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'learning_note_updated',
    entity: 'learning_notes',
    entityId: note.id,
  });

  return NextResponse.json(note);
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('learning:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.learningNote.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

  await prisma.learningNote.delete({ where: { id } });
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'learning_note_deleted',
    entity: 'learning_notes',
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
