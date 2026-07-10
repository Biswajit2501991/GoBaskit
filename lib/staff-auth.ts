import { NextResponse } from 'next/server';
import type { StaffRole } from '@prisma/client';
import type { Permission } from '@/types/staff';
import { getSession, getStaffFromSession, sessionHasPermission } from '@/lib/auth';
import { parsePermissions, staffHasPermission } from '@/types/staff';

/** Minimal staff identity from JWT (no DB). Enough for permission checks + actor ids. */
export type StaffAuthUser = {
  id: string;
  role: StaffRole;
  permissions: unknown;
  name: string;
  mobile: string;
};

function staffFromJwt(session: NonNullable<Awaited<ReturnType<typeof getSession>>>): StaffAuthUser | null {
  if (!('type' in session) || session.type !== 'staff') return null;
  return {
    id: session.sub,
    role: session.role,
    permissions: session.permissions,
    name: '',
    mobile: session.mobile,
  };
}

/**
 * Authorize a staff permission.
 * By default trusts JWT claims (no DB) — use for read routes.
 * Pass `{ live: true }` to re-check the staff row is still active (mutations / sensitive).
 */
export async function requireStaffPermission(
  permission: Permission,
  options?: { live?: boolean },
) {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), staff: null };
  }

  if (options?.live) {
    const staff = await getStaffFromSession();
    if (!staff) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), staff: null };
    }
    const perms = parsePermissions(staff.permissions);
    // Use DB role/permissions so role changes apply before JWT refresh.
    if (!staffHasPermission(staff.role, perms, permission)) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), staff: null };
    }
    return { error: null, staff: staff as StaffAuthUser };
  }

  // Fast path: JWT claims only (legacy email admin still needs DB).
  const fromJwt = staffFromJwt(session);
  if (fromJwt) {
    if (!sessionHasPermission(session, permission, fromJwt.permissions as string[], fromJwt.role)) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), staff: null };
    }
    return { error: null, staff: fromJwt };
  }

  const staff = await getStaffFromSession();
  if (!staff) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), staff: null };
  }
  const perms = parsePermissions(staff.permissions);
  if (!sessionHasPermission(session, permission, perms, staff.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), staff: null };
  }
  return { error: null, staff: staff as StaffAuthUser };
}

/**
 * Require any logged-in staff session.
 * Default: JWT only. Pass `{ live: true }` to verify active staff row.
 */
export async function requireStaffSession(options?: { live?: boolean }) {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      staff: null,
      session: null,
    };
  }

  if (options?.live) {
    const staff = await getStaffFromSession();
    if (!staff) {
      return {
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        staff: null,
        session: null,
      };
    }
    return { error: null, staff: staff as StaffAuthUser, session };
  }

  const fromJwt = staffFromJwt(session);
  if (fromJwt) {
    return { error: null, staff: fromJwt, session };
  }

  const staff = await getStaffFromSession();
  if (!staff) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      staff: null,
      session: null,
    };
  }
  return { error: null, staff: staff as StaffAuthUser, session };
}
