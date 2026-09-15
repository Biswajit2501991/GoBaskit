import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffPermission } from '@/lib/staff-auth';
import { accessRoleSchema, formatZodFlattenError } from '@/lib/validations';
import { parseAccessGrants } from '@/lib/staffAccess';
import { AuditService } from '@/services/AuditService';

async function requireAllSuperAdmin() {
  const auth = await requireStaffPermission('staff:manage', { live: true });
  if (auth.error) return { error: auth.error, staff: null };
  if (auth.staff!.role !== 'ALL_SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'Only All Super Admin can manage access roles' }, { status: 403 }), staff: null };
  }
  return { error: null, staff: auth.staff };
}

export async function GET() {
  const auth = await requireStaffPermission('staff:view');
  if (auth.error) return auth.error;
  if (auth.staff!.role !== 'ALL_SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const items = await prisma.accessRole.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, grants: true, updatedAt: true },
  });
  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      grants: parseAccessGrants(item.grants) ?? { sections: [] },
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAllSuperAdmin();
  if (auth.error) return auth.error;

  const parsed = accessRoleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodFlattenError(parsed.error.flatten()) }, { status: 400 });
  }

  const grants = parseAccessGrants(parsed.data.grants) ?? { sections: [] };
  try {
    const created = await prisma.accessRole.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || '',
        grants,
      },
      select: { id: true, name: true, description: true, grants: true, updatedAt: true },
    });
    await AuditService.log({
      staffId: auth.staff!.id,
      action: 'access_role_created',
      entity: 'access_roles',
      entityId: created.id,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
    if (code === 'P2002') {
      return NextResponse.json({ error: 'An access role with this name already exists' }, { status: 409 });
    }
    console.error('[admin/access-roles POST]', err);
    return NextResponse.json({ error: 'Failed to create access role' }, { status: 500 });
  }
}
