import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';
import {
  CUSTOMER_MOBILE_COOKIE,
  customerSessionClearOptions,
  getCustomerMobileFromRequest,
} from '@/lib/customer-session';

const SETTING_PREFIX = 'customer_mobile_';

export async function GET(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  return NextResponse.json({ mobile: mobile ?? null });
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

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_MOBILE_COOKIE, '', customerSessionClearOptions());
  return res;
}
