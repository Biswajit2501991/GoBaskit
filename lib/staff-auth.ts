import { NextResponse } from 'next/server';
import type { StaffRole } from '@prisma/client';
import type { Permission } from '@/types/staff';
import { getSession, getStaffFromSession } from '@/lib/auth';
import { accessInputFromStaff, staffHasEffectivePermission } from '@/lib/staffAccess';
import { SettingsService } from '@/services/SettingsService';

/** Minimal staff identity from JWT (no DB). Enough for permission checks + actor ids. */
export type StaffAuthUser = {
  id: string;
  role: StaffRole;
  permissions: unknown;
  name: string;
  mobile: string;
  shopId?: string | null;
  accessGrants?: unknown;
  accessRoleGrants?: unknown;
};

function staffFromJwt(session: NonNullable<Awaited<ReturnType<typeof getSession>>>): StaffAuthUser | null {
  if (!('type' in session) || session.type !== 'staff') return null;
  return {
    id: session.sub,
    role: session.role,
    permissions: session.permissions,
    name: session.name?.trim() || '',
    mobile: session.mobile,
    shopId: session.shopId ?? null,
    accessGrants: session.accessGrants ?? null,
    accessRoleGrants: session.accessRoleGrants ?? null,
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
    if (!staffHasEffectivePermission(accessInputFromStaff(staff), permission)) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), staff: null };
    }
    return { error: null, staff: staff as StaffAuthUser };
  }

  // Fast path: JWT claims only (legacy email admin still needs DB).
  const fromJwt = staffFromJwt(session);
  if (fromJwt) {
    if (!staffHasEffectivePermission(fromJwt, permission)) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), staff: null };
    }
    return { error: null, staff: fromJwt };
  }

  const staff = await getStaffFromSession();
  if (!staff) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), staff: null };
  }
  if (!staffHasEffectivePermission(accessInputFromStaff(staff), permission)) {
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

export async function requireShopStaff() {
  const staff = await getStaffFromSession();
  if (!staff || !staff.active || staff.deletedAt) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      staff: null,
    };
  }
  const shopId = 'shopId' in staff ? staff.shopId : null;
  if (!shopId) {
    return {
      error: NextResponse.json({ error: 'Use the shop login at /shop' }, { status: 403 }),
      staff: null,
    };
  }
  const isInternal = 'shop' in staff && staff.shop && (staff.shop as { isInternal?: boolean }).isInternal === true;
  if (isInternal) {
    return {
      error: NextResponse.json({ error: 'Use the shop login at /shop' }, { status: 403 }),
      staff: null,
    };
  }
  return {
    error: null,
    staff: { ...(staff as StaffAuthUser), shopId },
  };
}

export async function requireDeliveryPartner() {
  const staff = await getStaffFromSession();
  if (!staff || !staff.active || staff.deletedAt) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      staff: null,
    };
  }
  if (staff.role !== 'DELIVERY_PARTNER') {
    return {
      error: NextResponse.json({ error: 'Use the delivery login at /delivery' }, { status: 403 }),
      staff: null,
    };
  }
  return { error: null, staff: staff as StaffAuthUser };
}

/** Mutations that create or skip offers — not required to view /shop history. */
export async function requireShopSourcingEnabled() {
  const enabled = (await SettingsService.getStoreConfig()).shopSourcing.enabled;
  if (!enabled) {
    return NextResponse.json({ error: 'Shop sourcing is turned off' }, { status: 403 });
  }
  return null;
}
