import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';

const couponCreateSchema = z.object({
  couponCode: z.string().min(2).max(40),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().positive(),
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

export async function GET() {
  const auth = await requireStaffPermission('settings:view');
  if (auth.error) return auth.error;

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { usages: true } } },
  });
  return NextResponse.json({ coupons });
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('settings:edit');
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = couponCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const code = normalizeCode(parsed.data.couponCode);
  if (parsed.data.discountType === 'PERCENTAGE' && parsed.data.discountValue > 100) {
    return NextResponse.json({ error: 'Percentage cannot exceed 100' }, { status: 400 });
  }

  const existing = await prisma.coupon.findUnique({ where: { couponCode: code } });
  if (existing) {
    return NextResponse.json({ error: 'Coupon code already exists' }, { status: 400 });
  }

  const coupon = await prisma.coupon.create({
    data: {
      couponCode: code,
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue,
      maxDiscount: parsed.data.maxDiscount ?? null,
      minimumOrder: parsed.data.minimumOrder ?? 0,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null,
      status: parsed.data.status ?? 'ACTIVE',
      usageLimitPerMobile: parsed.data.usageLimitPerMobile ?? 3,
      totalUsageLimit: parsed.data.totalUsageLimit ?? null,
      description: parsed.data.description?.trim() ?? '',
    },
  });

  await AuditService.log({
    staffId: auth.staff?.id,
    action: 'coupon_created',
    entity: 'coupons',
    entityId: coupon.id,
    meta: { couponCode: coupon.couponCode },
  });

  return NextResponse.json(coupon, { status: 201 });
}
