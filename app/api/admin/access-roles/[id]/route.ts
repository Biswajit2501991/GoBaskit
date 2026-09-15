import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffPermission } from '@/lib/staff-auth';
import { accessRoleSchema, formatZodFlattenError } from '@/lib/validations';
import { parseAccessGrants } from '@/lib/staffAccess';
import { AuditService } from '@/services/AuditService';

type Params = { params: Promise<{ id: string }> };

async function requireAllSuperAdmin() {
  const auth = await requireStaffPermission('staff:manage', { live: true });
  if (auth.error) return { error: auth.error, staff: null };
  if (auth.staff!.role !== 'ALL_SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'Only All Super Admin can manage access roles' }, { status: 403 }), staff: null };
  }
  return { error: null, staff: auth.staff };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAllSuperAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;

  const parsed = accessRoleSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodFlattenError(parsed.error.flatten()) }, { status: 400 });
  }

  const existing = await prisma.accessRole.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description.trim();
  if (parsed.data.grants) data.grants = parseAccessGrants(parsed.data.grants) ?? { sections: [] };

  try {
    const updated = await prisma.accessRole.update({
      where: { id },
      data,
      select: { id: true, name: true, description: true, grants: true, updatedAt: true },
    });
    await AuditService.log({
      staffId: auth.staff!.id,
      action: 'access_role_updated',
      entity: 'access_roles',
      entityId: id,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
    if (code === 'P2002') {
      return NextResponse.json({ error: 'An access role with this name already exists' }, { status: 409 });
    }
    console.error('[admin/access-roles PATCH]', err);
    return NextResponse.json({ error: 'Failed to update access role' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAllSuperAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;

  const existing = await prisma.accessRole.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.accessRole.delete({ where: { id } });
  await AuditService.log({
    staffId: auth.staff!.id,
    action: 'access_role_deleted',
    entity: 'access_roles',
    entityId: id,
  });
  return NextResponse.json({ success: true });
}
