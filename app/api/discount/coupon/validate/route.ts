import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DiscountEngine } from '@/services/DiscountEngine';
import { checkRateLimit } from '@/lib/simple-rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';

const bodySchema = z.object({
  code: z.string().min(1).max(40),
  subtotal: z.number().positive(),
  /** @deprecated Ignored — coupons use the logged-in session mobile. */
  mobile: z.string().max(20).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const sessionMobile = getCustomerMobileFromRequest(req);
  if (!sessionMobile) {
    return NextResponse.json(
      { ok: false, code: 'LOGIN_REQUIRED', error: 'Please log in to apply a coupon' },
      { status: 401 },
    );
  }

  const meta = getRequestMeta(req);
  const limited = checkRateLimit(`coupon-validate:${meta.ip || 'unknown'}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, code: 'RATE_LIMIT', error: 'Too many attempts. Try again shortly.' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: 'INVALID', error: 'Invalid request' },
      { status: 400 },
    );
  }

  const result = await DiscountEngine.validateCoupon({
    code: parsed.data.code,
    subtotal: parsed.data.subtotal,
    mobile: sessionMobile,
  });

  if (!result.ok) {
    await DiscountEngine.logAttempt({
      mobile: sessionMobile,
      couponCode: parsed.data.code.trim().toUpperCase(),
      discountType: 'COUPON',
      status: result.code,
      appliedBy: 'customer',
      meta: { error: result.error },
    });
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
