import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';

const COOKIE_NAME = 'gobaskit_customer_mobile';
const SETTING_PREFIX = 'customer_mobile_';

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(COOKIE_NAME)?.value || '';
  const mobile = normalizeMobile(raw);
  if (!isValidIndianMobile(mobile)) {
    return NextResponse.json({ mobile: null });
  }
  return NextResponse.json({ mobile });
}

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

  const res = NextResponse.json({ ok: true, mobile });
  res.cookies.set(COOKIE_NAME, mobile, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
  return res;
}

