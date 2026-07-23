import { NextResponse } from 'next/server';
import { getSession, getStaffFromSession } from '@/lib/auth';
import { normalizeMobile } from '@/utils/mobile';

/**
 * Read-only check: is the admin/staff cookie still valid?
 * Used by the storefront header to keep "Open Admin" visible while the session lives.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    const staff = await getStaffFromSession();
    if (!staff) {
      return NextResponse.json({ authenticated: false });
    }

    const rawMobile =
      ('type' in session && session.type === 'staff' ? session.mobile : '') || staff.mobile || '';
    const mobile = normalizeMobile(rawMobile);

    return NextResponse.json({
      authenticated: true,
      mobile: mobile || null,
      name: staff.name || null,
      role: staff.role || null,
    });
  } catch (err) {
    console.error('[auth/staff-status]', err);
    return NextResponse.json({ authenticated: false });
  }
}
