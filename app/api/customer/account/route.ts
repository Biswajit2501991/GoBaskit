import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';
import { toE164 } from '@/utils/phone';
import {
  CUSTOMER_MOBILE_COOKIE,
  customerSessionClearOptions,
  getCustomerMobileFromRequest,
} from '@/lib/customer-session';
import {
  COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  clearAuthCookies,
  revokeStaffRefreshTokens,
  verifyToken,
} from '@/lib/auth';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';

const SETTING_PREFIX = 'customer_mobile_';

export async function GET(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({
      mobile: null,
      isWhatsappVerified: false,
      needsVerification: true,
      canCheckout: false,
    });
  }

  const e164 = toE164('91', mobile);
  if (!e164) {
    return NextResponse.json({
      mobile,
      isWhatsappVerified: false,
      needsVerification: true,
      canCheckout: false,
    });
  }

  const status = await WhatsAppVerificationService.getStatus(e164);
  return NextResponse.json({
    mobile,
    isWhatsappVerified: status.verified === true,
    needsVerification: status.needsVerification === true,
    canCheckout: status.canCheckout === true,
  });
}

/**
 * Records a "last seen" marker for a number. This deliberately does NOT create a
 * login session — a session cookie is only issued after proven ownership via
 * POST /api/customer/session. Setting a session from a bare number here was the
 * security gap that let anyone log in as any number.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const mobile = normalizeMobile(String(body?.mobile ?? ''));
  if (!isValidIndianMobile(mobile)) {
    return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
  }

  await prisma.setting.upsert({
    where: { key: `${SETTING_PREFIX}${mobile}` },
    update: { value: new Date().toISOString() },
    create: { key: `${SETTING_PREFIX}${mobile}`, value: new Date().toISOString() },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  // If this browser also has a staff session (admin shopping as customer),
  // revoke all staff refresh tokens and clear admin cookies too.
  const accessRaw = req.cookies.get(COOKIE_NAME)?.value;
  const session = accessRaw ? verifyToken(accessRaw) : null;
  if (session && 'type' in session && session.type === 'staff') {
    await revokeStaffRefreshTokens(session.sub).catch(() => null);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_MOBILE_COOKIE, '', customerSessionClearOptions());
  clearAuthCookies(res);
  // clearAuthCookies uses delete; also expire refresh explicitly for older clients
  res.cookies.delete(REFRESH_COOKIE_NAME);
  return res;
}
