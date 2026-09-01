import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getSession,
  getStaffFromSession,
  REFRESH_COOKIE_NAME,
  rotateStaffRefreshToken,
  setAuthCookies,
} from '@/lib/auth';
import { normalizeMobile } from '@/utils/mobile';

/**
 * Read-only check: is the admin/staff cookie still valid?
 * If the 1h access JWT expired, rotate the refresh cookie (same as heartbeat)
 * so a saved home-screen app still shows Open Admin without logging in again.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (session) {
      const staff = await getStaffFromSession();
      if (staff) {
        const rawMobile =
          ('type' in session && session.type === 'staff' ? session.mobile : '') || staff.mobile || '';
        return NextResponse.json({
          authenticated: true,
          mobile: normalizeMobile(rawMobile) || null,
          name: staff.name || null,
          role: staff.role || null,
        });
      }
    }

    const cookieStore = await cookies();
    const refreshRaw = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
    if (refreshRaw) {
      const rotated = await rotateStaffRefreshToken(refreshRaw);
      if (rotated) {
        const response = NextResponse.json({
          authenticated: true,
          mobile: normalizeMobile(rotated.staff.mobile) || null,
          name: rotated.staff.name || null,
          role: rotated.staff.role || null,
        });
        setAuthCookies(response, rotated.access, rotated.refresh);
        return response;
      }
    }

    return NextResponse.json({ authenticated: false });
  } catch (err) {
    console.error('[auth/staff-status]', err);
    return NextResponse.json({ authenticated: false });
  }
}
