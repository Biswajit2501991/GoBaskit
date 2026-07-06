import { NextRequest, NextResponse } from 'next/server';
import { CustomerProfileService } from '@/services/CustomerProfileService';
import { CustomerOrderService } from '@/services/CustomerOrderService';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { isValidIndianMobile, normalizeMobile } from '@/utils/mobile';
import type { SavedCheckoutProfile } from '@/utils/customerProfile';

export async function GET(req: NextRequest) {
  const fromCookie = getCustomerMobileFromRequest(req);
  const fromQuery = normalizeMobile(req.nextUrl.searchParams.get('mobile') || '');
  const mobile = fromCookie || (isValidIndianMobile(fromQuery) ? fromQuery : '');
  if (!mobile) {
    return NextResponse.json({ profile: null });
  }

  let profile = await CustomerProfileService.load(mobile);
  if (!profile) {
    profile = await CustomerOrderService.getLatestProfileForMobile(mobile);
    if (profile) {
      try {
        await CustomerProfileService.save(mobile, profile);
      } catch {
        /* backfill is best-effort */
      }
    }
  }

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
