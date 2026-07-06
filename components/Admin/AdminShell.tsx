'use client';

import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react';
import { LogoutButton } from '@/components/Admin/LogoutButton';
import { NotificationCenter } from '@/components/Admin/NotificationCenter';
import { AdminNavLink } from '@/components/Admin/AdminNavLink';

type AdminShellProps = {
  staff: { id: string; name: string; role: string };
  visibleNav: Array<{ href: string; label: string; permission?: string }>;
  children: React.ReactNode;
};

const SIDEBAR_PREF_KEY = 'gobaskit_admin_sidebar_collapsed';

async function logoutNow() {
  await Promise.all([
    fetch('/api/auth/login', { method: 'DELETE' }),
    fetch('/api/auth/staff-login', { method: 'DELETE' }),
  ]);
  window.location.href = '/';
}

export function AdminShell({ staff, visibleNav, children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_PREF_KEY) === '1';
  });
  const [pendingVerifications, setPendingVerifications] = useState(0);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_PREF_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    const hasVerificationNav = visibleNav.some((item) => item.href === '/admin/whatsapp-verification');
    if (!hasVerificationNav) return;

    const load = () => {
      fetch('/api/admin/whatsapp-verifications/pending-count')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (typeof data?.pendingCount === 'number') setPendingVerifications(data.pendingCount);
        })
        .catch(() => {});
    };

    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [visibleNav]);

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <aside
        className={`shrink-0 h-screen bg-white border-r border-gray-200 p-3 flex flex-col sticky top-0 transition-all duration-200 ${
          collapsed ? 'w-20' : 'w-56'
        }`}
      >
        <div className="mb-5">
          <div className="flex items-start justify-between gap-2">
            <div className={collapsed ? 'hidden' : 'block'}>
              <span className="font-extrabold text-lg">
                Go<span className="text-blinkit-green">Baskit</span>
              </span>
              <p className="text-xs text-gray-400 mt-1">Staff Portal</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{staff.name} · {staff.role.replace(/_/g, ' ')}</p>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="text-gray-400 hover:text-gray-700 rounded-lg p-1.5 hover:bg-gray-100"
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              title={collapsed ? 'Expand menu' : 'Collapse menu'}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto pr-1">
          {visibleNav.map((item) => (
            <AdminNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              collapsed={collapsed}
              badge={item.href === '/admin/whatsapp-verification' ? pendingVerifications : undefined}
            />
          ))}
        </nav>

        <div className="pt-3 mt-3 border-t border-gray-100">
          {collapsed ? (
            <button
              type="button"
              onClick={logoutNow}
              className="w-full inline-flex items-center justify-center text-red-500 hover:text-red-600 rounded-lg p-2 hover:bg-red-50"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <LogoutButton />
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 h-screen overflow-y-auto flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end gap-3 sticky top-0 z-10">
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-700">{staff.name}</p>
            <p className="text-[10px] text-gray-400">{staff.role.replace(/_/g, ' ')}</p>
          </div>
          <NotificationCenter staffId={staff.id} />
        </header>
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}

