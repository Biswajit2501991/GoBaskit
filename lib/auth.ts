import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import type { StaffRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  parsePermissions,
  staffHasPermission,
  type Permission,
  type SessionPayload,
  type StaffSessionPayload,
} from '@/types/staff';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export const COOKIE_NAME = 'gobaskit_admin_token';
export const REFRESH_COOKIE_NAME = 'gobaskit_staff_refresh';

const ACCESS_TTL = '1h';
const REFRESH_TTL_DEFAULT = 7 * 24 * 60 * 60; // 7 days
const REFRESH_TTL_REMEMBER = 30 * 24 * 60 * 60; // 30 days

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Legacy email admin JWT (backward compatible). */
export function signAdminToken(adminId: string, email: string) {
  return jwt.sign({ sub: adminId, email, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
}

export function signStaffAccessToken(staff: {
  id: string;
  mobile: string;
  role: StaffRole;
  permissions: unknown;
}) {
  const payload: StaffSessionPayload = {
    sub: staff.id,
    mobile: staff.mobile,
    role: staff.role,
    permissions: parsePermissions(staff.permissions),
    type: 'staff',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function createStaffRefreshToken(staffId: string, rememberMe: boolean) {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(raw);
  const maxAge = rememberMe ? REFRESH_TTL_REMEMBER : REFRESH_TTL_DEFAULT;
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  await prisma.staffRefreshToken.create({
    data: { staffId, tokenHash, expiresAt, rememberMe },
  });

  return { raw, maxAge };
}

export async function rotateStaffRefreshToken(oldRaw: string) {
  const tokenHash = hashToken(oldRaw);
  const existing = await prisma.staffRefreshToken.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
    include: { staff: true },
  });
  if (!existing || !existing.staff.active || existing.staff.deletedAt) return null;

  await prisma.staffRefreshToken.delete({ where: { id: existing.id } });
  const access = signStaffAccessToken(existing.staff);
  const refresh = await createStaffRefreshToken(existing.staffId, existing.rememberMe);
  return { staff: existing.staff, access, refresh };
}

export async function revokeStaffRefreshTokens(staffId: string) {
  await prisma.staffRefreshToken.deleteMany({ where: { staffId } });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** @deprecated use getSession */
export async function getAdminSession() {
  return getSession();
}

export async function getStaffFromSession() {
  const session = await getSession();
  if (!session) return null;

  if ('type' in session && session.type === 'staff') {
    const staff = await prisma.staffAccount.findFirst({
      where: { id: session.sub, active: true, deletedAt: null },
    });
    return staff;
  }

  // Legacy admin table
  const admin = await prisma.admin.findUnique({ where: { id: session.sub } });
  if (!admin?.isActive) return null;
  return {
    id: admin.id,
    mobile: '',
    email: admin.email,
    name: admin.name,
    role: 'SUPER_ADMIN' as StaffRole,
    passwordHash: '',
    permissions: [],
    active: true,
    deletedAt: null,
    lastLogin: null,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

export function sessionHasPermission(
  session: SessionPayload | null,
  permission: Permission,
  customPermissions: string[] = [],
  role: StaffRole = 'READ_ONLY',
): boolean {
  if (!session) return false;
  if ('email' in session && session.role === 'admin') return true;
  if ('type' in session && session.type === 'staff') {
    return staffHasPermission(session.role, session.permissions, permission);
  }
  return staffHasPermission(role, customPermissions, permission);
}

export function setAuthCookies(
  response: { cookies: { set: (name: string, value: string, opts: object) => void } },
  accessToken: string,
  refresh?: { raw: string; maxAge: number },
) {
  response.cookies.set(COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60,
    path: '/',
  });
  if (refresh) {
    response.cookies.set(REFRESH_COOKIE_NAME, refresh.raw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refresh.maxAge,
      path: '/',
    });
  }
}

export function clearAuthCookies(response: { cookies: { delete: (name: string) => void } }) {
  response.cookies.delete(COOKIE_NAME);
  response.cookies.delete(REFRESH_COOKIE_NAME);
}
