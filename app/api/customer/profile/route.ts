import { NextRequest, NextResponse } from 'next/server';
import { CustomerProfileService } from '@/services/CustomerProfileService';
import { isValidIndianMobile, normalizeMobile } from '@/utils/mobile';
import type { SavedCheckoutProfile } from '@/utils/customerProfile';

const COOKIE_NAME = 'gobaskit_customer_mobile';

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(COOKIE_NAME)?.value || req.nextUrl.searchParams.get('mobile') || '';
  const mobile = normalizeMobile(raw);
  if (!isValidIndianMobile(mobile)) {
    return NextResponse.json({ profile: null });
  }
  const profile = await CustomerProfileService.load(mobile);
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const mobile = normalizeMobile(String(body?.mobile ?? ''));
  if (!isValidIndianMobile(mobile)) {
    return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
  }

  const profile = body?.profile as SavedCheckoutProfile | undefined;
  if (!profile?.firstName) {
    return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });
  }

  await CustomerProfileService.save(mobile, { ...profile, mobile });
  return NextResponse.json({ ok: true });
}
