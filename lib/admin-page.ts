import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { StaffRole } from '@prisma/client';
import { parsePermissions, type Permission } from '@/types/staff';
import { adminLoginHref } from '@/lib/adminDeepLink';
import {
  accessInputFromStaff,
  canAccessAdminPath,
  staffHasEffectivePermission,
  staffPortalHomePath,
} from '@/lib/staffAccess';

export type AdminStaff = {
  id: string;
  name: string;
  role: StaffRole;
  permissions: unknown;
  accessGrants?: unknown;
  accessRoleGrants?: unknown;
  accessRole?: { grants?: unknown } | null;
  shopId?: string | null;
};

export async function adminLoginRedirectHref(): Promise<string> {
  const h = await headers();
  const path = h.get('x-pathname') || '';
  const search = h.get('x-search') || '';
  return adminLoginHref(`${path}${search}`);
}

export async function requireAdminPage(staff: AdminStaff | null, permission: Permission) {
  if (!staff) redirect(await adminLoginRedirectHref());

  const accessStaff = accessInputFromStaff(staff);
  const perms = parsePermissions(staff.permissions);
  const pathname = (await headers()).get('x-pathname') || '';
  const allowedPermission = staffHasEffectivePermission(accessStaff, permission);
  const allowedPath = !pathname || canAccessAdminPath(accessStaff, pathname);
  if (!allowedPermission || !allowedPath) {
    redirect(staffPortalHomePath({ ...accessStaff, shopId: staff.shopId }));
  }

  return { staff, perms };
}
