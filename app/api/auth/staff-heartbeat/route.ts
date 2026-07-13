import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_COOKIE_NAME,
  rotateStaffRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  verifyToken,
  COOKIE_NAME,
  signStaffAccessToken,
} from '@/lib/auth';
import { SettingsService } from '@/services/SettingsService';
import { prisma } from '@/lib/prisma';

/**
 * Keep staff session alive while the admin tab is in use.
 * Renews access (+ refresh when present) and returns idle-timeout settings.
 */
export async function POST(req: NextRequest) {
  const refreshRaw = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  const accessRaw = req.cookies.get(COOKIE_NAME)?.value;

  let accessToken: string | null = null;
  let refresh: { raw: string; maxAge: number } | undefined;

  if (refreshRaw) {
    const rotated = await rotateStaffRefreshToken(refreshRaw);
    if (rotated) {
      accessToken = rotated.access;
      refresh = rotated.refresh;
    }
  }

  // Refresh missing/expired but access JWT still valid → renew access only
  // (leave existing refresh cookie untouched).
  if (!accessToken && accessRaw) {
    const session = verifyToken(accessRaw);
    if (session && 'type' in session && session.type === 'staff') {
      const staff = await prisma.staffAccount.findFirst({
        where: { id: session.sub, active: true, deletedAt: null },
      });
      if (staff) {
        accessToken = signStaffAccessToken(staff);
      }
    }
  }

  if (!accessToken) {
    const response = NextResponse.json({ error: 'Session expired' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const config = await SettingsService.getStoreConfig();
  const response = NextResponse.json({
    success: true,
    idleTimeoutEnabled: config.staffIdleTimeoutEnabled,
    idleTimeoutMinutes: config.staffIdleTimeoutMinutes,
  });
  setAuthCookies(response, accessToken, refresh);
  return response;
}
