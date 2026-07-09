import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DiscountEngine } from '@/services/DiscountEngine';

const bodySchema = z.object({
  subtotal: z.number().positive(),
  type: z.enum(['COUPON', 'MEMBERSHIP']),
  couponCode: z.string().max(40).optional().nullable(),
  mobile: z.string().max(20).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: 'INVALID', error: 'Invalid request' },
      { status: 400 },
    );
  }

  if (parsed.data.type === 'COUPON') {
    const result = await DiscountEngine.validateCoupon({
      code: parsed.data.couponCode || '',
      subtotal: parsed.data.subtotal,
      mobile: parsed.data.mobile,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  const result = await DiscountEngine.checkMembership({
    mobile: parsed.data.mobile || '',
    subtotal: parsed.data.subtotal,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
