import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { learningNoteSchema, formatZodFlattenError } from '@/lib/validations';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';

const noteInclude = {
  author: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
} as const;

const PAAN_CORNER_GUIDE = {
  title: 'How to set up /category/paan-corner',
  body: `Admin → Categories → Add Category

1. Name: Paan Corner
2. Slug: paan-corner (or leave blank — it auto-creates from the name)
3. Check Active (visible on store)
4. Save

Admin → Products (or Inventory Desk)

1. Add/edit products and set Category to Paan Corner
2. Keep Visible on store on

Optional homepage banner — Admin → Settings → Promo Cards

1. Link: /category/paan-corner
2. Turn Toggle live on and Save

The promo card only links to the category; it does not create it. After steps 1–2, https://www.gobaskitkaro.com/category/paan-corner will show those products.`,
};

async function ensureStarterNotes() {
  const count = await prisma.learningNote.count();
  if (count > 0) return;
  await prisma.learningNote.create({
    data: {
      title: PAAN_CORNER_GUIDE.title,
      body: PAAN_CORNER_GUIDE.body,
    },
  });
}

export async function GET() {
  const auth = await requireStaffPermission('learning:view');
  if (auth.error) return auth.error;

  try {
    await ensureStarterNotes();
    const notes = await prisma.learningNote.findMany({
      orderBy: { updatedAt: 'desc' },
      include: noteInclude,
    });
    return NextResponse.json({ items: notes });
  } catch (err) {
    console.error('[admin/learning GET]', err);
    return NextResponse.json({ error: 'Failed to load learning notes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('learning:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json();
  const parsed = learningNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodFlattenError(parsed.error.flatten()) },
      { status: 400 },
    );
  }

  const staffId = auth.staff?.id ?? null;
  const note = await prisma.learningNote.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      authorId: staffId,
      updatedById: staffId,
    },
    include: noteInclude,
  });

  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'learning_note_created',
    entity: 'learning_notes',
    entityId: note.id,
  });

  return NextResponse.json(note, { status: 201 });
}
