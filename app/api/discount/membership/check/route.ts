import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DiscountEngine } from '@/services/DiscountEngine';
import { checkRateLimit } from '@/lib/simple-rate-limit';
import { getRequestMeta } from '@/lib/request-meta';

const bodySchema = z.object({
  mobile: z.string().min(8).max(20),
  subtotal: z.number().positive(),
});

export async function POST(req: NextRequest) {
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
    mobile: parsed.data.mobile,
    subtotal: parsed.data.subtotal,
  });

  if (!result.ok) {
    await DiscountEngine.logAttempt({
      mobile: parsed.data.mobile,
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
