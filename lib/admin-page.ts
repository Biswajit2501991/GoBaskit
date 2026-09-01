import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { StaffRole } from '@prisma/client';
import { getRoleDefaultAdminPath, parsePermissions, staffHasPermission, type Permission } from '@/types/staff';
import { adminLoginHref } from '@/lib/adminDeepLink';

export type AdminStaff = {
  id: string;
  name: string;
  role: StaffRole;
  permissions: unknown;
};

export async function adminLoginRedirectHref(): Promise<string> {
  const h = await headers();
  const path = h.get('x-pathname') || '';
  const search = h.get('x-search') || '';
  return adminLoginHref(`${path}${search}`);
}

export async function requireAdminPage(staff: AdminStaff | null, permission: Permission) {
  if (!staff) redirect(await adminLoginRedirectHref());

  const perms = parsePermissions(staff.permissions);
  if (!staffHasPermission(staff.role, perms, permission)) {
    redirect(getRoleDefaultAdminPath(staff.role));
  }

  return { staff, perms };
}
