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
import { isStaffIdleExpired } from '@/lib/staffIdle';
import { prisma } from '@/lib/prisma';

/**
 * Keep staff session alive while the admin/shop UI is used.
 * Renews access (+ refresh when present) and returns idle-timeout settings.
 * Body `{ activity: true }` resets the sliding idle window.
 */
export async function POST(req: NextRequest) {
  const refreshRaw = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  const accessRaw = req.cookies.get(COOKIE_NAME)?.value;

  let accessToken: string | null = null;
  let refresh: { raw: string; maxAge: number } | undefined;
  let staffId: string | null = null;
  let lastActiveAt: Date | null = null;

  const accessSession = accessRaw ? verifyToken(accessRaw) : null;
  const accessStaff =
    accessSession && 'type' in accessSession && accessSession.type === 'staff' ? accessSession : null;

  if (accessStaff) {
    const stillActive = await prisma.staffAccount.findFirst({
      where: { id: accessStaff.sub, active: true, deletedAt: null },
      select: {
        id: true,
        lastActiveAt: true,
        mobile: true,
        role: true,
        permissions: true,
        name: true,
        shopId: true,
        accessGrants: true,
        accessRole: { select: { grants: true } },
      },
    });
    if (!stillActive) {
      const response = NextResponse.json({ error: 'Session expired' }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }
    staffId = stillActive.id;
    lastActiveAt = stillActive.lastActiveAt;
    // Access JWT still valid — renew it from claims (no refresh-token rotate).
    accessToken = signStaffAccessToken({
      id: stillActive.id,
      mobile: stillActive.mobile,
      role: stillActive.role,
      permissions: stillActive.permissions,
      name: stillActive.name,
      shopId: stillActive.shopId,
      accessGrants: stillActive.accessGrants,
      accessRole: stillActive.accessRole,
    });
  } else if (refreshRaw) {
    const rotated = await rotateStaffRefreshToken(refreshRaw);
    if (rotated) {
      accessToken = rotated.access;
      refresh = rotated.refresh;
      staffId = rotated.staff.id;
      lastActiveAt = rotated.staff.lastActiveAt;
    }
  }

  if (!accessToken || !staffId) {
    const response = NextResponse.json({ error: 'Session expired' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const config = await SettingsService.getStoreConfig();
  if (
    isStaffIdleExpired(lastActiveAt, {
      enabled: config.staffIdleTimeoutEnabled,
      minutes: config.staffIdleTimeoutMinutes,
    })
  ) {
    const response = NextResponse.json({ error: 'Session expired' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const body = (await req.json().catch(() => ({}))) as { activity?: unknown };
  if (body.activity === true) {
    const now = new Date();
    lastActiveAt = now;
    await prisma.staffAccount.update({
      where: { id: staffId },
      data: { lastActiveAt: now },
    });
  }

  const response = NextResponse.json({
    success: true,
    idleTimeoutEnabled: config.staffIdleTimeoutEnabled,
    idleTimeoutMinutes: config.staffIdleTimeoutMinutes,
  });
  setAuthCookies(response, accessToken, refresh);
  return response;
}
