import { NextRequest, NextResponse } from 'next/server';
import { customerPasswordSchema } from '@/lib/validations';
import { isValidE164 } from '@/utils/phone';
import { CustomerAuthService } from '@/services/CustomerAuthService';
import {
  CUSTOMER_MOBILE_COOKIE,
  createCustomerSessionToken,
  customerSessionCookieOptions,
} from '@/lib/customer-session';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = customerPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.confirmPassword?.[0]
      ?? parsed.error.flatten().fieldErrors.password?.[0]
      ?? 'Invalid password';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const mobileE164 = parsed.data.mobile.trim();
  if (!isValidE164(mobileE164)) {
    return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
  }

  try {
    const { mobile10 } = await CustomerAuthService.setPassword({
      mobileE164,
      password: parsed.data.password,
      verificationId: parsed.data.verificationId,
    });

    const res = NextResponse.json({ ok: true, mobile: mobile10 });
    res.cookies.set(
      CUSTOMER_MOBILE_COOKIE,
      createCustomerSessionToken(mobile10),
      customerSessionCookieOptions(),
    );
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to set password';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
