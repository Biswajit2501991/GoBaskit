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

  const accessSession = accessRaw ? verifyToken(accessRaw) : null;
  const accessStaff =
    accessSession && 'type' in accessSession && accessSession.type === 'staff' ? accessSession : null;

  if (accessStaff) {
    const stillActive = await prisma.staffAccount.findFirst({
      where: { id: accessStaff.sub, active: true, deletedAt: null },
      select: { id: true },
    });
    if (!stillActive) {
      const response = NextResponse.json({ error: 'Session expired' }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }
    // Access JWT still valid — renew it from claims (no refresh-token rotate).
    accessToken = signStaffAccessToken({
      id: accessStaff.sub,
      mobile: accessStaff.mobile,
      role: accessStaff.role,
      permissions: accessStaff.permissions,
      name: accessStaff.name,
    });
  } else if (refreshRaw) {
    const rotated = await rotateStaffRefreshToken(refreshRaw);
    if (rotated) {
      accessToken = rotated.access;
      refresh = rotated.refresh;
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
