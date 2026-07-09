import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';

type RouteContext = { params: Promise<{ id: string }> };

const couponUpdateSchema = z.object({
  couponCode: z.string().min(2).max(40).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  discountValue: z.number().positive().optional(),
  maxDiscount: z.number().positive().nullable().optional(),
  minimumOrder: z.number().min(0).optional(),
  startDate: z.string().datetime().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  usageLimitPerMobile: z.number().int().min(1).max(100).optional(),
  totalUsageLimit: z.number().int().min(1).nullable().optional(),
  description: z.string().max(500).optional(),
});

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('settings:view');
  if (auth.error) return auth.error;

  const { id } = await params;
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: { _count: { select: { usages: true } } },
  });
  if (!coupon) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(coupon);
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('settings:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = couponUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const discountType = parsed.data.discountType ?? existing.discountType;
  const discountValue = parsed.data.discountValue ?? existing.discountValue;
  if (discountType === 'PERCENTAGE' && discountValue > 100) {
    return NextResponse.json({ error: 'Percentage cannot exceed 100' }, { status: 400 });
  }

  let couponCode = existing.couponCode;
  if (parsed.data.couponCode) {
    couponCode = normalizeCode(parsed.data.couponCode);
    if (couponCode !== existing.couponCode) {
      const clash = await prisma.coupon.findUnique({ where: { couponCode } });
      if (clash) {
        return NextResponse.json({ error: 'Coupon code already exists' }, { status: 400 });
      }
    }
  }

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      couponCode,
      discountType,
      discountValue,
      ...(parsed.data.maxDiscount !== undefined ? { maxDiscount: parsed.data.maxDiscount } : {}),
      ...(parsed.data.minimumOrder !== undefined ? { minimumOrder: parsed.data.minimumOrder } : {}),
      ...(parsed.data.startDate !== undefined
        ? { startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null }
        : {}),
      ...(parsed.data.expiryDate !== undefined
        ? { expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null }
        : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.usageLimitPerMobile !== undefined
        ? { usageLimitPerMobile: parsed.data.usageLimitPerMobile }
        : {}),
      ...(parsed.data.totalUsageLimit !== undefined
        ? { totalUsageLimit: parsed.data.totalUsageLimit }
        : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description.trim() }
        : {}),
    },
  });

  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'coupon_updated',
    entity: 'coupons',
    entityId: coupon.id,
    meta: { couponCode: coupon.couponCode },
  });

  return NextResponse.json(coupon);
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireStaffPermission('settings:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.coupon.delete({ where: { id } });
  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'coupon_deleted',
    entity: 'coupons',
    entityId: id,
    meta: { couponCode: existing.couponCode },
  });

  return NextResponse.json({ ok: true });
}
