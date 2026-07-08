import { NextRequest, NextResponse } from 'next/server';
import { customerLoginSchema } from '@/lib/validations';
import { isValidE164, e164ToCheckoutMobile } from '@/utils/phone';
import { isValidIndianMobile } from '@/utils/mobile';
import { CustomerAuthService } from '@/services/CustomerAuthService';
import {
  CUSTOMER_MOBILE_COOKIE,
  createCustomerSessionToken,
  customerSessionCookieOptions,
} from '@/lib/customer-session';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = customerLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid mobile or password' }, { status: 400 });
  }

  const mobileE164 = parsed.data.mobile.trim();
  if (!isValidE164(mobileE164)) {
    return NextResponse.json({ error: 'Invalid mobile or password' }, { status: 401 });
  }

  const mobile10 = e164ToCheckoutMobile(mobileE164);
  if (!isValidIndianMobile(mobile10)) {
    return NextResponse.json({ error: 'Invalid mobile or password' }, { status: 401 });
  }

  const result = await CustomerAuthService.login(mobileE164, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        locked: 'locked' in result ? result.locked : undefined,
        attemptsRemaining: 'attemptsRemaining' in result ? result.attemptsRemaining : undefined,
      },
      { status: result.code === 'LOCKED' ? 403 : 401 },
    );
  }

  const res = NextResponse.json({ ok: true, mobile: result.mobile10 });
  res.cookies.set(
    CUSTOMER_MOBILE_COOKIE,
    createCustomerSessionToken(result.mobile10),
    customerSessionCookieOptions(),
  );
  return res;
}
