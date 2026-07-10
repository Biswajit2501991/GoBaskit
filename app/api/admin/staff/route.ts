import { NextRequest, NextResponse } from 'next/server';
import type { StaffRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { staffCreateSchema, formatZodFlattenError } from '@/lib/validations';
import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';
import { requireStaffPermission } from '@/lib/staff-auth';
import { StaffService } from '@/services/StaffService';
import { AuditService } from '@/services/AuditService';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('staff:view');
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const data = await StaffService.list({
      search: searchParams.get('search') || undefined,
      role: (searchParams.get('role') as StaffRole) || undefined,
      active: searchParams.get('active') === 'false' ? false : searchParams.get('active') === 'true' ? true : undefined,
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 20),
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error('[admin/staff GET]', err);
    return NextResponse.json({ error: 'Failed to load staff list' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('staff:manage', { live: true });
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = staffCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodFlattenError(parsed.error.flatten()) },
      { status: 400 }
    );
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  if (!isValidIndianMobile(mobile)) {
    return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
  }

  const existing = await prisma.staffAccount.findFirst({
    where: {
      OR: [{ mobile }, ...(parsed.data.email ? [{ email: parsed.data.email }] : [])],
    },
  });
  if (existing) {
    if (existing.deletedAt) {
      return NextResponse.json(
        {
          error:
            'This mobile belongs to a deactivated staff account. Reactivate that staff member instead of creating a new one.',
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Mobile or email already exists' }, { status: 409 });
  }

  if (parsed.data.role === 'ALL_SUPER_ADMIN' && auth.staff!.role !== 'ALL_SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Only All Super Admin can create another All Super Admin' },
      { status: 403 },
    );
  }

  const password = parsed.data.password || 'changeme123';
  try {
    const staff = await prisma.staffAccount.create({
      data: {
        name: parsed.data.name,
        mobile,
        email: parsed.data.email || null,
        role: parsed.data.role,
        passwordHash: await hashPassword(password),
        permissions: parsed.data.permissions ?? [],
        active: parsed.data.active ?? true,
        assignedCity: parsed.data.assignedCity || null,
        assignedAreas: parsed.data.assignedAreas ?? [],
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        deliveryRadius: parsed.data.deliveryRadius ?? null,
      },
      select: {
        id: true, name: true, mobile: true, email: true, role: true, permissions: true, active: true,
        assignedCity: true, assignedAreas: true, latitude: true, longitude: true, deliveryRadius: true,
        createdAt: true,
      },
    });

    StaffService.invalidateMobileCache(mobile);
    await AuditService.log({
      staffId: auth.staff!.id,
      action: 'staff_created',
      entity: 'staff_accounts',
      entityId: staff.id,
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'Mobile or email already exists' },
        { status: 409 },
      );
    }
    console.error('[admin/staff POST]', err);
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
  }
}
