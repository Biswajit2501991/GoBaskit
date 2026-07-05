'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blinkit-green-light text-blinkit-green'
          : 'text-gray-700 hover:bg-blinkit-green-light hover:text-blinkit-green'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      {label}
    </Link>
  );
}

