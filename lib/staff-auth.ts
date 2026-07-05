import { NextResponse } from 'next/server';
import type { Permission } from '@/types/staff';
import { getSession, getStaffFromSession, sessionHasPermission } from '@/lib/auth';
import { parsePermissions } from '@/types/staff';

export async function requireStaffPermission(permission: Permission) {
  const session = await getSession();
  const staff = await getStaffFromSession();
  if (!session || !staff) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), staff: null };
  }
  const perms = parsePermissions(staff.permissions);
  if (!sessionHasPermission(session, permission, perms, staff.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), staff: null };
  }
  return { error: null, staff };
}

export async function requireStaffSession() {
  const staff = await getStaffFromSession();
  const session = await getSession();
  if (!session || !staff) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), staff: null, session: null };
  }
  return { error: null, staff, session };
}
