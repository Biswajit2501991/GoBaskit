import { redirect } from 'next/navigation';
import type { StaffRole } from '@prisma/client';
import { getRoleDefaultAdminPath, parsePermissions, staffHasPermission, type Permission } from '@/types/staff';

export type AdminStaff = {
  id: string;
  name: string;
  role: StaffRole;
  permissions: unknown;
};

export function requireAdminPage(staff: AdminStaff | null, permission: Permission) {
  if (!staff) redirect('/admin');

  const perms = parsePermissions(staff.permissions);
  if (!staffHasPermission(staff.role, perms, permission)) {
    redirect(getRoleDefaultAdminPath(staff.role));
  }

  return { staff, perms };
}
