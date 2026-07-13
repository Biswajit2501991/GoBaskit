import { NextRequest, NextResponse } from 'next/server';
import { staffLoginSchema } from '@/lib/validations';
import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';
import {
  verifyPassword,
  signStaffAccessToken,
  createStaffRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  REFRESH_COOKIE_NAME,
  COOKIE_NAME,
  rotateStaffRefreshToken,
  revokeStaffRefreshTokens,
  verifyToken,
} from '@/lib/auth';
import {
  CUSTOMER_MOBILE_COOKIE,
  createCustomerSessionToken,
  customerSessionClearOptions,
  customerSessionCookieOptions,
} from '@/lib/customer-session';
import { StaffService } from '@/services/StaffService';
import { AuditService } from '@/services/AuditService';

const MAX_FAILED_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = staffLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  if (!isValidIndianMobile(mobile)) {
    return NextResponse.json({ error: 'Invalid mobile or password' }, { status: 401 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
  const failed = await StaffService.countRecentFailedAttempts(mobile);
  if (failed >= MAX_FAILED_ATTEMPTS) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again in 15 minutes.' },
      { status: 429 },
    );
  }

  const staff = await StaffService.findByMobile(mobile);
  if (!staff) {
    await StaffService.recordLoginAttempt(mobile, false, ip);
    return NextResponse.json({ error: 'Invalid mobile or password' }, { status: 401 });
  }

  const valid = await verifyPassword(parsed.data.password, staff.passwordHash);
  if (!valid) {
    await StaffService.recordLoginAttempt(mobile, false, ip);
    await AuditService.log({ staffId: staff.id, action: 'login_failed', ip });
    return NextResponse.json({ error: 'Invalid mobile or password' }, { status: 401 });
  }

  await StaffService.recordLoginAttempt(mobile, true, ip);
  await StaffService.updateLastLogin(staff.id);
  await AuditService.log({ staffId: staff.id, action: 'login_success', ip });

  const access = signStaffAccessToken(staff);
  const refresh = await createStaffRefreshToken(staff.id, parsed.data.rememberMe ?? false);

  const response = NextResponse.json({
    success: true,
    staff: {
      id: staff.id,
      name: staff.name,
      mobile: staff.mobile,
      role: staff.role,
    },
  });
  setAuthCookies(response, access, refresh);
  // Dual-role: open a customer session on the same response so storefront
  // offers (membership / coupons) work without a second round-trip.
  response.cookies.set(
    CUSTOMER_MOBILE_COOKIE,
    createCustomerSessionToken(mobile),
    customerSessionCookieOptions(),
  );
  return response;
}

export async function DELETE(req: NextRequest) {
  // Revoke every refresh token for this staff so other browsers/devices
  // cannot stay signed in after logout.
  const accessRaw = req.cookies.get(COOKIE_NAME)?.value;
  const session = accessRaw ? verifyToken(accessRaw) : null;
  if (session && 'type' in session && session.type === 'staff') {
    await revokeStaffRefreshTokens(session.sub).catch(() => null);
    await AuditService.log({
      staffId: session.sub,
      action: 'logout',
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
    }).catch(() => null);
  }

  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  // Staff login also issues a customer session — clear that too so logout
  // returns a clean storefront Home experience.
  response.cookies.set(CUSTOMER_MOBILE_COOKIE, '', customerSessionClearOptions());
  return response;
}

/** Refresh access token using httpOnly refresh cookie. */
export async function PUT(req: NextRequest) {
  const refreshRaw = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!refreshRaw) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const rotated = await rotateStaffRefreshToken(refreshRaw);
  if (!rotated) {
    const response = NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true });
  setAuthCookies(response, rotated.access, rotated.refresh);
  return response;
}
