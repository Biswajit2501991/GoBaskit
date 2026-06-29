import Link from 'next/link';
import { getAdminSession } from '@/lib/auth';
import { LogoutButton } from '@/components/Admin/LogoutButton';

const nav = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/bulk-upload', label: 'Bulk Upload' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {session && (
        <aside className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col">
          <div className="mb-8">
            <span className="font-extrabold text-lg">Go<span className="text-blinkit-green">Baskit</span></span>
            <p className="text-xs text-gray-400 mt-1">Admin Panel</p>
          </div>
          <nav className="space-y-1 flex-1">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-blinkit-green-light hover:text-blinkit-green">
                {item.label}
              </Link>
            ))}
          </nav>
          <LogoutButton />
        </aside>
      )}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
