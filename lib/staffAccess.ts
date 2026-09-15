import type { StaffRole } from '@prisma/client';
import { ADMIN_NAV_ITEMS, adminNavForPath } from '@/lib/adminNav';
import { SETTINGS_NAV_SECTIONS, settingsSectionAccessId } from '@/lib/settingsNav';
import {
  getRoleDefaultAdminPath,
  parsePermissions,
  staffHasPermission,
  type Permission,
} from '@/types/staff';

export type AccessGrants = {
  sections: string[];
};

export type AccessNode = {
  id: string;
  label: string;
  group: string;
  kind: 'page' | 'action' | 'settings';
  href?: string;
  permission: Permission;
  parentId?: string;
};

const PAGE_ACTIONS: Array<{ href: string; permission: Permission; label: string }> = [
  { href: '/admin/products', permission: 'products:edit', label: 'Edit products' },
  { href: '/admin/products', permission: 'products:delete', label: 'Delete products' },
  { href: '/admin/inventory', permission: 'products:edit', label: 'Edit stock' },
  { href: '/admin/price-adjust', permission: 'products:edit', label: 'Change prices' },
  { href: '/admin/categories', permission: 'categories:edit', label: 'Edit categories' },
  { href: '/admin/orders', permission: 'orders:edit', label: 'Edit orders' },
  { href: '/admin/orders', permission: 'orders:delete', label: 'Delete / archive orders' },
  { href: '/admin/orders', permission: 'orders:assign', label: 'Assign orders' },
  { href: '/admin/orders', permission: 'orders:override_lock', label: 'Override lock' },
  { href: '/admin/delivery', permission: 'delivery:update', label: 'Update delivery' },
  { href: '/admin/whatsapp-verification', permission: 'verification:manage', label: 'Approve numbers' },
  { href: '/admin/finance', permission: 'finance:edit', label: 'Edit finance' },
  { href: '/admin/profit-dashboard', permission: 'settings:edit', label: 'Toggle profit dashboard' },
  { href: '/admin/staff', permission: 'staff:manage', label: 'Add / edit staff' },
  { href: '/admin/settings', permission: 'settings:edit', label: 'Edit settings' },
  { href: '/admin/learning', permission: 'learning:edit', label: 'Edit learning' },
];

export function pageAccessId(href: string): string {
  return `page:${href}`;
}

export function actionAccessId(href: string, permission: Permission): string {
  return `action:${href}:${permission}`;
}

export function buildAccessCatalog(): AccessNode[] {
  const nodes: AccessNode[] = ADMIN_NAV_ITEMS.map((item) => ({
    id: pageAccessId(item.href),
    label: item.label,
    group: item.group,
    kind: 'page',
    href: item.href,
    permission: item.permission,
  }));

  for (const action of PAGE_ACTIONS) {
    nodes.push({
      id: actionAccessId(action.href, action.permission),
      label: action.label,
      group: ADMIN_NAV_ITEMS.find((item) => item.href === action.href)?.group ?? 'Store',
      kind: 'action',
      href: action.href,
      permission: action.permission,
      parentId: pageAccessId(action.href),
    });
  }

  for (const section of SETTINGS_NAV_SECTIONS) {
    nodes.push({
      id: settingsSectionAccessId(section.id),
      label: section.label,
      group: `Settings · ${section.group}`,
      kind: 'settings',
      href: '/admin/settings',
      permission: 'settings:view',
      parentId: pageAccessId('/admin/settings'),
    });
  }

  return nodes;
}

export const ACCESS_CATALOG = buildAccessCatalog();

const CATALOG_BY_ID = new Map(ACCESS_CATALOG.map((node) => [node.id, node]));

export function sanitizeSectionIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => CATALOG_BY_ID.has(id)))];
}

export function parseAccessGrants(raw: unknown): AccessGrants | null {
  if (raw == null) return null;
  if (typeof raw !== 'object') return null;
  const sections = (raw as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return null;
  return { sections: sanitizeSectionIds(sections.filter((id): id is string => typeof id === 'string')) };
}

export type StaffAccessInput = {
  role: StaffRole;
  permissions?: unknown;
  accessGrants?: unknown;
  accessRoleGrants?: unknown;
  accessRole?: { grants?: unknown } | null;
};

export function accessInputFromStaff(staff: StaffAccessInput): StaffAccessInput {
  return {
    role: staff.role,
    permissions: staff.permissions,
    accessGrants: staff.accessGrants,
    accessRoleGrants: staff.accessRoleGrants ?? staff.accessRole?.grants,
  };
}

export type ResolvedStaffAccess = {
  unrestricted: boolean;
  allowlist: boolean;
  sectionIds: Set<string>;
  hrefs: Set<string>;
};

export function defaultSectionIdsForRole(role: StaffRole, extraPermissions: string[] = []): string[] {
  if (role === 'ALL_SUPER_ADMIN') return ACCESS_CATALOG.map((node) => node.id);
  return ACCESS_CATALOG.filter((node) => staffHasPermission(role, extraPermissions, node.permission)).map(
    (node) => node.id,
  );
}

export function resolveStaffAccess(staff: StaffAccessInput): ResolvedStaffAccess {
  const extra = parsePermissions(staff.permissions);
  if (staff.role === 'ALL_SUPER_ADMIN') {
    return {
      unrestricted: true,
      allowlist: false,
      sectionIds: new Set(ACCESS_CATALOG.map((node) => node.id)),
      hrefs: new Set(ADMIN_NAV_ITEMS.map((item) => item.href)),
    };
  }

  const explicit = parseAccessGrants(staff.accessGrants);
  const fromRole = parseAccessGrants(staff.accessRoleGrants);
  const source = explicit ?? fromRole;
  const allowlist = Boolean(source);
  const sectionIds = new Set(source ? source.sections : defaultSectionIdsForRole(staff.role, extra));

  if (sectionIds.has(pageAccessId('/admin/settings'))) {
    const anySettingsChild = ACCESS_CATALOG.some(
      (node) => node.kind === 'settings' && sectionIds.has(node.id),
    );
    if (!anySettingsChild) {
      for (const node of ACCESS_CATALOG) {
        if (node.kind === 'settings') sectionIds.add(node.id);
      }
    }
  }

  const hrefs = new Set<string>();
  for (const id of sectionIds) {
    const node = CATALOG_BY_ID.get(id);
    if (node?.kind === 'page' && node.href) hrefs.add(node.href);
  }

  return { unrestricted: false, allowlist, sectionIds, hrefs };
}

export function canAccessAdminPath(staff: StaffAccessInput, pathname: string): boolean {
  const access = resolveStaffAccess(staff);
  if (access.unrestricted) return true;
  const match = adminNavForPath(
    pathname,
    ADMIN_NAV_ITEMS.map((item) => ({
      href: item.href,
      label: item.label,
      group: item.group,
      hint: item.hint,
    })),
  );
  if (!match) return true;
  return access.hrefs.has(match.href);
}

export function canAccessSettingsSection(staff: StaffAccessInput, sectionId: string): boolean {
  const access = resolveStaffAccess(staff);
  if (access.unrestricted) return true;
  if (!access.hrefs.has('/admin/settings')) return false;
  return access.sectionIds.has(settingsSectionAccessId(sectionId));
}

export function visibleAdminNav(staff: StaffAccessInput) {
  const access = resolveStaffAccess(staff);
  return ADMIN_NAV_ITEMS.filter((item) => access.unrestricted || access.hrefs.has(item.href)).map((item) => ({
    href: item.href,
    label: item.label,
    group: item.group,
    hint: item.hint,
  }));
}

export function staffHasEffectivePermission(staff: StaffAccessInput, permission: Permission): boolean {
  if (staff.role === 'ALL_SUPER_ADMIN') return true;
  const extra = parsePermissions(staff.permissions);
  const access = resolveStaffAccess(staff);
  if (!access.allowlist) {
    return staffHasPermission(staff.role, extra, permission);
  }
  return ACCESS_CATALOG.some((node) => node.permission === permission && access.sectionIds.has(node.id));
}

export function firstAllowedAdminPath(staff: StaffAccessInput, fallback: string): string {
  const access = resolveStaffAccess(staff);
  if (access.unrestricted) return fallback;
  const match = ADMIN_NAV_ITEMS.find((item) => access.hrefs.has(item.href));
  return match?.href ?? (access.allowlist ? '/admin' : fallback);
}

export function staffPortalHomePath(
  staff: StaffAccessInput & { shopId?: string | null },
): string {
  if (staff.shopId) return '/shop';
  if (staff.role === 'DELIVERY_PARTNER') return '/delivery';
  return firstAllowedAdminPath(staff, getRoleDefaultAdminPath(staff.role));
}

export function permissionsFromSectionIds(sectionIds: string[]): Permission[] {
  const perms = new Set<Permission>();
  for (const id of sectionIds) {
    const node = CATALOG_BY_ID.get(id);
    if (node) perms.add(node.permission);
  }
  return [...perms];
}

export function accessFieldsForWrite(
  actorRole: StaffRole,
  input: { accessGrants?: AccessGrants | null; accessRoleId?: string | null },
): {
  accessGrants?: AccessGrants | null;
  accessRoleId?: string | null;
  permissions?: Permission[];
} {
  if (actorRole !== 'ALL_SUPER_ADMIN') return {};
  const data: {
    accessGrants?: AccessGrants | null;
    accessRoleId?: string | null;
    permissions?: Permission[];
  } = {};
  if (input.accessRoleId !== undefined) data.accessRoleId = input.accessRoleId;
  if (input.accessGrants !== undefined) {
    const grants =
      input.accessGrants == null ? null : { sections: sanitizeSectionIds(input.accessGrants.sections) };
    data.accessGrants = grants;
    data.permissions = grants ? permissionsFromSectionIds(grants.sections) : [];
  }
  return data;
}
