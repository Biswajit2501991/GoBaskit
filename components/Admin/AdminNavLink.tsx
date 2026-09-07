'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Archive,
  BadgeCheck,
  BarChart3,
  BookOpen,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  Upload,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

const ADMIN_ICONS: Record<string, LucideIcon> = {
  '/admin/dashboard': LayoutDashboard,
  '/admin/analytics': BarChart3,
  '/admin/delivery': Truck,
  '/admin/inventory': ClipboardList,
  '/admin/finance': Wallet,
  '/admin/products': ShoppingBag,
  '/admin/price-adjust': SlidersHorizontal,
  '/admin/categories': FolderTree,
  '/admin/orders': Package,
  '/admin/feedback': MessageSquare,
  '/admin/whatsapp-verification': BadgeCheck,
  '/admin/bulk-upload': Upload,
  '/admin/staff': Users,
  '/admin/settings': Settings,
  '/admin/learning': BookOpen,
  '/admin/archive': Archive,
};

export function AdminNavLink({
  href,
  label,
  hint,
  collapsed = false,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  hint?: string;
  collapsed?: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  const Icon = ADMIN_ICONS[href] ?? LayoutDashboard;
  const title = hint ? `${label}. ${hint}` : label;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center rounded-xl text-sm transition-colors ${
        isActive
          ? 'bg-blinkit-green-light text-blinkit-green font-semibold'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
      } ${collapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'}`}
      aria-current={isActive ? 'page' : undefined}
      title={title}
    >
      <span className="relative shrink-0">
        <Icon size={16} className="opacity-80" />
        {collapsed && badge ? (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
        ) : null}
      </span>
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          {badge ? (
            <span className="inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </span>
      )}
    </Link>
  );
}
