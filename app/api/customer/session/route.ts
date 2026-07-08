import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidE164, e164ToCheckoutMobile } from '@/utils/phone';
import { isValidIndianMobile, normalizeMobile } from '@/utils/mobile';
import { getStaffFromSession } from '@/lib/auth';
import {
  CUSTOMER_MOBILE_COOKIE,
  createCustomerSessionToken,
  customerSessionCookieOptions,
} from '@/lib/customer-session';

const bodySchema = z.object({
  mobile: z.string().min(8).max(20),
});

function issueSession(mobile10: string) {
  const res = NextResponse.json({ ok: true, verified: true, mobile: mobile10 });
  res.cookies.set(
    CUSTOMER_MOBILE_COOKIE,
    createCustomerSessionToken(mobile10),
    customerSessionCookieOptions(),
  );
  return res;
}

/**
 * Staff-only customer session shortcut. Regular customers must log in with
 * mobile + password (POST /api/customer/login) or set a password after
 * WhatsApp verification (POST /api/customer/password).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const mobileE164 = parsed.data.mobile.trim();
  if (!isValidE164(mobileE164)) {
    return NextResponse.json({ error: 'Enter a valid mobile number' }, { status: 400 });
  }

  const mobile10 = e164ToCheckoutMobile(mobileE164);
  if (!isValidIndianMobile(mobile10)) {
    return NextResponse.json({ error: 'Unsupported mobile number' }, { status: 400 });
  }

  const staff = await getStaffFromSession().catch(() => null);
  if (staff?.mobile && normalizeMobile(staff.mobile) === mobile10) {
    return issueSession(mobile10);
  }

  return NextResponse.json(
    { verified: false, error: 'Use mobile and password to sign in' },
    { status: 403 },
  );
}
