'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNavLink({
  href,
  label,
  collapsed = false,
  badge,
}: {
  href: string;
  label: string;
  collapsed?: boolean;
  badge?: number;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`block rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blinkit-green-light text-blinkit-green'
          : 'text-gray-700 hover:bg-blinkit-green-light hover:text-blinkit-green'
      } ${collapsed ? 'px-2 py-2 text-center' : 'px-3 py-2'}`}
      aria-current={isActive ? 'page' : undefined}
      title={label}
    >
      {collapsed ? (
        <span className="relative inline-flex w-7 h-7 items-center justify-center rounded-md bg-black/5 text-xs font-bold">
          {label.charAt(0)}
          {badge ? <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" /> : null}
        </span>
      ) : (
        <span className="flex items-center justify-between gap-2">
          <span>{label}</span>
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

