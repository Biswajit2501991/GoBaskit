'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { LogoutButton } from '@/components/Admin/LogoutButton';
import { NotificationCenter } from '@/components/Admin/NotificationCenter';
import { AdminNavLink } from '@/components/Admin/AdminNavLink';
import AdminMasterSearch from '@/components/Admin/AdminMasterSearch';
import AdminThemeToggle from '@/components/Admin/AdminThemeToggle';
import { subscribeToAdminEvents } from '@/lib/realtime/adminEventsClient';
import { logoutEverywhere } from '@/utils/logoutEverywhere';
import StaffSessionKeeper from '@/components/Admin/StaffSessionKeeper';
import { adminNavForPath, groupAdminNav, type AdminNavLinkItem } from '@/lib/adminNav';

type AdminShellProps = {
  staff: { id: string; name: string; role: string };
  visibleNav: AdminNavLinkItem[];
  children: React.ReactNode;
};

const SIDEBAR_PREF_KEY = 'gobaskit_admin_sidebar_collapsed';

export function AdminShell({ staff, visibleNav, children }: AdminShellProps) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_PREF_KEY) === '1';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const navGroups = groupAdminNav(visibleNav);
  const currentNav = adminNavForPath(pathname, visibleNav);
  const showPageHint = Boolean(currentNav) && !pathname.startsWith('/admin/settings');

  // Warm Products/Categories only after staff have been idle on a light page.
  // Heavy desks (orders, dashboard, products, …) load their own APIs first.
  useEffect(() => {
    const skipWarm =
      pathname.startsWith('/admin/settings') ||
      pathname.startsWith('/admin/staff') ||
      pathname.startsWith('/admin/learning') ||
      pathname.startsWith('/admin/dashboard') ||
      pathname.startsWith('/admin/analytics') ||
      pathname.startsWith('/admin/finance') ||
      pathname.startsWith('/admin/orders') ||
      pathname.startsWith('/admin/delivery') ||
      pathname.startsWith('/admin/whatsapp-verification') ||
      pathname.startsWith('/admin/bulk-upload') ||
      pathname.startsWith('/admin/price-adjust') ||
      pathname.startsWith('/admin/products') ||
      pathname.startsWith('/admin/inventory') ||
      pathname.startsWith('/admin/categories');
    const hasProducts = visibleNav.some(
      (item) => item.href === '/admin/products' || item.href === '/admin/inventory',
    );
    if (skipWarm || !hasProducts) return;

    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      void import('@/store/adminProductsStore').then(({ useAdminProductsStore }) => {
        const store = useAdminProductsStore.getState();
        void store.fetchCategories();
        void store.fetchProducts({ page: 1, sort: 'name' });
      });
    };

    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(warm, { timeout: 3000 });
    } else {
      timeoutId = setTimeout(warm, 800);
    }

    return () => {
      cancelled = true;
      if (idleId != null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pathname, visibleNav]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_PREF_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Nested scroll container — Next.js window scroll restore does not apply here.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  useEffect(() => {
    const hasVerificationNav = visibleNav.some((item) => item.href === '/admin/whatsapp-verification');
    if (!hasVerificationNav) return;

    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;

    const load = () => {
      fetch('/api/admin/whatsapp-verifications/pending-count')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && typeof data?.pendingCount === 'number') {
            setPendingVerifications(data.pendingCount);
          }
        })
        .catch(() => {});
    };

    const start = () => {
      if (cancelled) return;
      load();
      // Slower poll; SSE also bumps the badge when verification events arrive.
      intervalId = setInterval(load, 60_000);
      unsubscribe = subscribeToAdminEvents((event) => {
        if (event.type === 'whatsapp_verification_updated') {
          load();
        }
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(start, { timeout: 4000 });
    } else {
      timeoutId = setTimeout(start, 1500);
    }

    return () => {
      cancelled = true;
      if (idleId != null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      unsubscribe?.();
    };
  }, [visibleNav]);

  function renderNav(opts: { collapsed: boolean; onNavigate?: () => void }) {
    return (
      <nav className="space-y-4 flex-1 overflow-y-auto pr-1" aria-label="Admin pages">
        {navGroups.map((group) => (
          <div key={group.name}>
            {!opts.collapsed ? (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                {group.name}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <AdminNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  hint={item.hint}
                  collapsed={opts.collapsed}
                  badge={item.href === '/admin/whatsapp-verification' ? pendingVerifications : undefined}
                  onNavigate={opts.onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <StaffSessionKeeper />
      <aside
        className={`hidden lg:flex shrink-0 h-screen flex-col sticky top-0 border-r border-gray-200/80 bg-white/95 p-3 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] transition-[width] duration-200 ${
          collapsed ? 'w-[4.5rem]' : 'w-60'
        }`}
      >
        <div className="mb-5">
          <div className="flex items-start justify-between gap-2">
            <div className={collapsed ? 'hidden' : 'block min-w-0'}>
              <span className="font-extrabold text-lg tracking-tight">
                Go<span className="text-blinkit-green">Baskit</span>
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 mt-2">
                Staff Portal
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                {staff.name} · {staff.role.replace(/_/g, ' ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="text-gray-400 hover:text-gray-700 rounded-xl p-1.5 hover:bg-gray-50"
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              title={collapsed ? 'Expand menu' : 'Collapse menu'}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {renderNav({ collapsed })}

        <div className="pt-3 mt-3 border-t border-gray-100">
          {collapsed ? (
            <button
              type="button"
              onClick={() => {
                void logoutEverywhere('/');
              }}
              className="w-full inline-flex items-center justify-center text-red-500 hover:text-red-600 rounded-xl p-2 hover:bg-red-50"
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

      {mobileOpen ? (
        <div className="lg:hidden fixed inset-0 z-30">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-[min(19rem,88vw)] bg-white border-r border-gray-200/80 p-3 flex flex-col shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)]">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="font-extrabold text-lg tracking-tight">
                  Go<span className="text-blinkit-green">Baskit</span>
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 mt-2">
                  Staff Portal
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                  {staff.name} · {staff.role.replace(/_/g, ' ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="text-gray-400 hover:text-gray-700 rounded-xl p-1.5 hover:bg-gray-50"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderNav({ collapsed: false, onNavigate: () => setMobileOpen(false) })}
            <div className="pt-3 mt-3 border-t border-gray-100">
              <LogoutButton />
            </div>
          </aside>
        </div>
      ) : null}

      <main ref={mainRef} className="flex-1 min-w-0 h-screen overflow-y-auto flex flex-col">
        <header className="bg-white/95 border-b border-gray-200/80 px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button
            type="button"
            className="lg:hidden shrink-0 rounded-xl p-2 text-gray-600 hover:bg-gray-50"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
          <AdminMasterSearch navItems={visibleNav} />
          <AdminThemeToggle />
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-xs font-semibold text-gray-700">{staff.name}</p>
            <p className="text-[10px] text-gray-400">{staff.role.replace(/_/g, ' ')}</p>
          </div>
          <NotificationCenter staffId={staff.id} />
        </header>
        {showPageHint && currentNav ? (
          <div className="px-4 sm:px-6 py-3 border-b border-gray-200/80 bg-gray-50/80">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
              {currentNav.group}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-gray-500">{currentNav.hint}</p>
          </div>
        ) : null}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
