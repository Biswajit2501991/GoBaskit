import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, revokeStaffRefreshTokens } from '@/lib/auth';
import { staffUpdateSchema, formatZodFlattenError } from '@/lib/validations';
import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';
import { requireStaffPermission } from '@/lib/staff-auth';
import { StaffService } from '@/services/StaffService';
import { AuditService } from '@/services/AuditService';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireStaffPermission('staff:manage', { live: true });
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const parsed = staffUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodFlattenError(parsed.error.flatten()) },
      { status: 400 }
    );
  }

  const existing = await prisma.staffAccount.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.name) data.name = parsed.data.name;
  let nextEmail: string | null | undefined;
  if (parsed.data.email !== undefined) {
    nextEmail = parsed.data.email || null;
    data.email = nextEmail;
  }
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.permissions) data.permissions = parsed.data.permissions;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.assignedCity !== undefined) data.assignedCity = parsed.data.assignedCity || null;
  if (parsed.data.assignedAreas) data.assignedAreas = parsed.data.assignedAreas;
  if (parsed.data.latitude !== undefined) data.latitude = parsed.data.latitude;
  if (parsed.data.longitude !== undefined) data.longitude = parsed.data.longitude;
  if (parsed.data.deliveryRadius !== undefined) data.deliveryRadius = parsed.data.deliveryRadius;

  let nextMobile: string | undefined;
  if (parsed.data.mobile) {
    const mobile = normalizeMobile(parsed.data.mobile);
    if (!isValidIndianMobile(mobile)) {
      return NextResponse.json({ error: 'Invalid mobile' }, { status: 400 });
    }
    nextMobile = mobile;
    data.mobile = mobile;
  }

  const conflictChecks = [];
  if (nextMobile) {
    conflictChecks.push(
      prisma.staffAccount.findFirst({
        where: { id: { not: id }, deletedAt: null, mobile: nextMobile },
        select: { id: true },
      }),
    );
  }
  if (nextEmail) {
    conflictChecks.push(
      prisma.staffAccount.findFirst({
        where: { id: { not: id }, deletedAt: null, email: nextEmail },
        select: { id: true },
      }),
    );
  }
  if (conflictChecks.length > 0) {
    const conflicts = await Promise.all(conflictChecks);
    if (conflicts.some(Boolean)) {
      return NextResponse.json({ error: 'Mobile or email already exists' }, { status: 409 });
    }
  }

  if (parsed.data.password) {
    data.passwordHash = await hashPassword(parsed.data.password);
    await revokeStaffRefreshTokens(id);
  }

  let staff;
  try {
    staff = await prisma.staffAccount.update({
      where: { id },
      data,
      select: {
        id: true, name: true, mobile: true, email: true, role: true, permissions: true, active: true,
        assignedCity: true, assignedAreas: true, latitude: true, longitude: true, deliveryRadius: true,
        updatedAt: true,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to update staff. Please try again.' }, { status: 500 });
  }

  StaffService.invalidateMobileCache(existing.mobile);
  if (parsed.data.mobile) StaffService.invalidateMobileCache(staff.mobile);

  await AuditService.log({
    staffId: auth.staff!.id,
    action: 'staff_updated',
    entity: 'staff_accounts',
    entityId: id,
    meta: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json(staff);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireStaffPermission('staff:manage', { live: true });
  if (auth.error) return auth.error;

  const { id } = await params;
  if (id === auth.staff!.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const existing = await prisma.staffAccount.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.staffAccount.update({
    where: { id },
    data: { deletedAt: new Date(), active: false },
  });
  await revokeStaffRefreshTokens(id);
  StaffService.invalidateMobileCache(existing.mobile);

  await AuditService.log({
    staffId: auth.staff!.id,
    action: 'staff_deleted',
    entity: 'staff_accounts',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
