import type { Permission } from '@/types/staff';

export type AdminNavItem = {
  href: string;
  label: string;
  permission: Permission;
  group: string;
  hint: string;
};

/** Same destinations and permission gates as before — groups and hints are presentation only. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    permission: 'analytics:view',
    group: 'Overview',
    hint: 'Today’s orders and a live snapshot of the store. Nothing is changed from this page.',
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    permission: 'analytics:view',
    group: 'Overview',
    hint: 'Reports and trends. Viewing this does not change orders, stock, or settings.',
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    permission: 'orders:view',
    group: 'Fulfilment',
    hint: 'Accept, pack, and update live customer orders.',
  },
  {
    href: '/admin/shops',
    label: 'Shops',
    permission: 'settings:view',
    group: 'Fulfilment',
    hint: 'Onboard shops for multi-shop sourcing. Off until you enable Shop sourcing in Settings.',
  },
  {
    href: '/admin/delivery',
    label: 'Delivery Desk',
    permission: 'delivery:view',
    group: 'Fulfilment',
    hint: 'Assign riders and track orders that are out for delivery.',
  },
  {
    href: '/admin/feedback',
    label: 'Feedback',
    permission: 'orders:view',
    group: 'Fulfilment',
    hint: 'Star ratings customers left after a delivered order.',
  },
  {
    href: '/admin/archive',
    label: 'Archive',
    permission: 'orders:view',
    group: 'Fulfilment',
    hint: 'Older orders moved off the live desk. Open an order to see its history.',
  },
  {
    href: '/admin/whatsapp-verification',
    label: 'WhatsApp Verification',
    permission: 'verification:view',
    group: 'Fulfilment',
    hint: 'Approve customer WhatsApp numbers so they can complete checkout.',
  },
  {
    href: '/admin/products',
    label: 'Products',
    permission: 'products:view',
    group: 'Catalogue',
    hint: 'Catalogue, prices, stock display, and Best Seller flags used on home.',
  },
  {
    href: '/admin/categories',
    label: 'Categories',
    permission: 'categories:view',
    group: 'Catalogue',
    hint: 'Storefront category list and sort order.',
  },
  {
    href: '/admin/inventory',
    label: 'Inventory Desk',
    permission: 'products:view',
    group: 'Catalogue',
    hint: 'Stock on hand and reservations. Does not place customer orders.',
  },
  {
    href: '/admin/price-adjust',
    label: 'Price Adjust',
    permission: 'products:edit',
    group: 'Catalogue',
    hint: 'Change prices on products that already exist in the catalogue.',
  },
  {
    href: '/admin/bulk-upload',
    label: 'Bulk Upload',
    permission: 'bulk_upload:use',
    group: 'Catalogue',
    hint: 'Import or update products from a spreadsheet.',
  },
  {
    href: '/admin/finance',
    label: 'Finance Desk',
    permission: 'finance:view',
    group: 'Store',
    hint: 'Payments and settlement views. It does not check out customers.',
  },
  {
    href: '/admin/staff',
    label: 'Staff',
    permission: 'staff:view',
    group: 'Store',
    hint: 'Staff logins, roles, and what each person can open in Admin.',
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    permission: 'settings:view',
    group: 'Store',
    hint: 'Hours, delivery, homepage, overnight checkout, and other store switches.',
  },
  {
    href: '/admin/learning',
    label: 'Learning',
    permission: 'learning:view',
    group: 'Store',
    hint: 'Guides for staff. Opening this does not change live store data.',
  },
];

export const ADMIN_NAV_GROUP_ORDER = ['Overview', 'Fulfilment', 'Catalogue', 'Store'] as const;

export type AdminNavLinkItem = {
  href: string;
  label: string;
  group: string;
  hint: string;
};

export function groupAdminNav(items: AdminNavLinkItem[]): Array<{ name: string; items: AdminNavLinkItem[] }> {
  const byHref = new Map(items.map((item) => [item.href, item]));
  return ADMIN_NAV_GROUP_ORDER.map((name) => ({
    name,
    items: ADMIN_NAV_ITEMS.filter((item) => item.group === name && byHref.has(item.href)).map(
      (item) => byHref.get(item.href)!,
    ),
  })).filter((group) => group.items.length > 0);
}

export function adminNavForPath(pathname: string, items: AdminNavLinkItem[]): AdminNavLinkItem | null {
  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.href.length - a.href.length)[0];
}
