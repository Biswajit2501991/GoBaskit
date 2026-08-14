import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DiscountEngine } from '@/services/DiscountEngine';
import { checkRateLimit } from '@/lib/simple-rate-limit';
import { getRequestMeta } from '@/lib/request-meta';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { toE164 } from '@/utils/phone';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';

const bodySchema = z.object({
  subtotal: z.number().positive(),
  /** @deprecated Ignored — membership is always checked against the logged-in session mobile. */
  mobile: z.string().min(8).max(20).optional(),
});

export async function POST(req: NextRequest) {
  const sessionMobile = getCustomerMobileFromRequest(req);
  if (!sessionMobile) {
    return NextResponse.json(
      { ok: false, code: 'LOGIN_REQUIRED', error: 'Please log in to verify membership' },
      { status: 401 },
    );
  }

  const mobileE164 = toE164('91', sessionMobile);
  const isVerified = mobileE164
    ? await WhatsAppVerificationService.isMobileVerified(mobileE164)
    : false;
  if (!isVerified) {
    return NextResponse.json(
      {
        ok: false,
        code: 'VERIFICATION_REQUIRED',
        error: 'Verify your WhatsApp number before checking membership.',
      },
      { status: 403 },
    );
  }

  const meta = getRequestMeta(req);
  const limited = checkRateLimit(`membership-check:${meta.ip || 'unknown'}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, code: 'RATE_LIMIT', error: 'Too many membership checks. Try again shortly.' },
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

  const result = await DiscountEngine.checkMembership({
    mobile: sessionMobile,
    subtotal: parsed.data.subtotal,
  });

  if (!result.ok) {
    await DiscountEngine.logAttempt({
      mobile: sessionMobile,
      membership: true,
      discountType: 'MEMBERSHIP',
      status: result.code,
      appliedBy: 'customer',
      meta: { error: result.error },
    });
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
