import type { StaffRole } from '@prisma/client';

export const STAFF_ROLES: StaffRole[] = [
  'SUPER_ADMIN',
  'MANAGER',
  'ORDER_MANAGER',
  'INVENTORY_MANAGER',
  'DELIVERY_MANAGER',
  'CUSTOMER_SUPPORT',
  'FINANCE',
  'MARKETING',
  'READ_ONLY',
  'CUSTOM',
];

export type Permission =
  | 'staff:view'
  | 'staff:manage'
  | 'staff:bulk_import'
  | 'products:view'
  | 'products:edit'
  | 'products:delete'
  | 'categories:view'
  | 'categories:edit'
  | 'orders:view'
  | 'orders:edit'
  | 'orders:delete'
  | 'orders:assign'
  | 'orders:override_lock'
  | 'settings:view'
  | 'settings:edit'
  | 'analytics:view'
  | 'bulk_upload:use'
  | 'finance:view'
  | 'finance:edit'
  | 'delivery:view'
  | 'delivery:update'
  | 'verification:view'
  | 'verification:manage'
  | 'learning:view'
  | 'learning:edit';

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  SUPER_ADMIN: [
    'staff:view', 'staff:manage', 'staff:bulk_import',
    'products:view', 'products:edit', 'products:delete',
    'categories:view', 'categories:edit',
    'orders:view', 'orders:edit', 'orders:delete', 'orders:assign', 'orders:override_lock',
    'settings:view', 'settings:edit', 'analytics:view', 'bulk_upload:use',
    'finance:view', 'finance:edit', 'delivery:view', 'delivery:update',
    'verification:view', 'verification:manage',
    'learning:view', 'learning:edit',
  ],
  MANAGER: [
    'staff:view', 'products:view', 'products:edit', 'categories:view', 'categories:edit',
    'orders:view', 'orders:edit', 'orders:assign', 'settings:view', 'analytics:view',
    'bulk_upload:use', 'delivery:view', 'delivery:update',
    'verification:view', 'verification:manage',
    'learning:view', 'learning:edit',
  ],
  ORDER_MANAGER: [
    'orders:view', 'orders:edit', 'orders:assign', 'delivery:view', 'delivery:update',
    'products:view', 'verification:view', 'verification:manage',
    'learning:view', 'learning:edit',
  ],
  INVENTORY_MANAGER: [
    'products:view', 'products:edit', 'categories:view', 'categories:edit', 'bulk_upload:use',
    'learning:view', 'learning:edit',
  ],
  DELIVERY_MANAGER: [
    'orders:view', 'orders:edit', 'delivery:view', 'delivery:update',
    'learning:view', 'learning:edit',
  ],
  CUSTOMER_SUPPORT: [
    'orders:view', 'products:view', 'verification:view', 'verification:manage',
    'learning:view', 'learning:edit',
  ],
  FINANCE: [
    'orders:view', 'finance:view', 'finance:edit', 'analytics:view',
    'learning:view', 'learning:edit',
  ],
  MARKETING: [
    'products:view', 'analytics:view', 'settings:view',
    'learning:view', 'learning:edit',
  ],
  READ_ONLY: [
    'products:view', 'categories:view', 'orders:view', 'analytics:view',
    'learning:view',
  ],
  CUSTOM: [],
};

export interface StaffSessionPayload {
  sub: string;
  mobile: string;
  role: StaffRole;
  permissions: string[];
  type: 'staff';
}

export interface LegacyAdminSessionPayload {
  sub: string;
  email: string;
  role: 'admin';
  type?: undefined;
}

export type SessionPayload = StaffSessionPayload | LegacyAdminSessionPayload;

/** Audit label for legacy email admin or staff mobile login. */
export function getSessionActorLabel(session: SessionPayload): string {
  if ('email' in session) return session.email;
  return session.mobile;
}

export function parsePermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === 'string');
}

export function staffHasPermission(
  role: StaffRole,
  customPermissions: string[],
  permission: Permission,
): boolean {
  if (role === 'SUPER_ADMIN') return true;
  if (customPermissions.includes(permission)) return true;
  if (role === 'CUSTOM') return customPermissions.includes(permission);
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRoleDefaultAdminPath(role: StaffRole): string {
  switch (role) {
    case 'DELIVERY_MANAGER':
      return '/admin/delivery';
    case 'ORDER_MANAGER':
    case 'CUSTOMER_SUPPORT':
      return '/admin/orders';
    case 'INVENTORY_MANAGER':
      return '/admin/inventory';
    case 'FINANCE':
      return '/admin/finance';
    case 'MARKETING':
      return '/admin/analytics';
    case 'READ_ONLY':
      return '/admin/orders';
    default:
      return '/admin/dashboard';
  }
}
