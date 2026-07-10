import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, revokeStaffRefreshTokens } from '@/lib/auth';
import { requireStaffPermission } from '@/lib/staff-auth';
import { openStaffPassword, sealStaffPassword } from '@/lib/staff-password-vault';
import { StaffService } from '@/services/StaffService';
import { AuditService } from '@/services/AuditService';

type Params = { params: Promise<{ id: string }> };

async function requireAllSuperAdmin() {
  const auth = await requireStaffPermission('staff:manage', { live: true });
  if (auth.error) return auth;
  if (auth.staff!.role !== 'ALL_SUPER_ADMIN') {
    return {
      error: NextResponse.json(
        { error: 'Only All Super Admin can view or change staff passwords' },
        { status: 403 },
      ),
      staff: null,
    };
  }
  return auth;
}

/** View sealed staff password (All Super Admin only). */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAllSuperAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const existing = await prisma.staffAccount.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true, mobile: true, role: true, passwordVault: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const password = openStaffPassword(existing.passwordVault);
  return NextResponse.json({
    id: existing.id,
    name: existing.name,
    mobile: existing.mobile,
    role: existing.role,
    password,
    available: password != null,
  });
}

/** Set / replace staff password (All Super Admin only). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAllSuperAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const existing = await prisma.staffAccount.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.staffAccount.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(password),
      passwordVault: sealStaffPassword(password),
    },
  });
  await revokeStaffRefreshTokens(id);
  StaffService.invalidateMobileCache(existing.mobile);

  await AuditService.log({
    staffId: auth.staff!.id,
    action: 'staff_password_updated',
    entity: 'staff_accounts',
    entityId: id,
  });

  return NextResponse.json({ success: true, password });
}
