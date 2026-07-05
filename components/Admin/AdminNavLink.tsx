'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNavLink({
  href,
  label,
  collapsed = false,
}: {
  href: string;
  label: string;
  collapsed?: boolean;
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
        <span className="inline-flex w-7 h-7 items-center justify-center rounded-md bg-black/5 text-xs font-bold">
          {label.charAt(0)}
        </span>
      ) : (
        label
      )}
    </Link>
  );
}

