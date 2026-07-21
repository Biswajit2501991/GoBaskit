'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, CornerDownLeft } from 'lucide-react';

type NavItem = { href: string; label: string };

type SearchDestination = {
  id: string;
  label: string;
  href: string;
  group: string;
  keywords: string[];
};

const SETTINGS_DESTINATIONS: Omit<SearchDestination, 'group'>[] = [
  {
    id: 'settings-min-order',
    label: 'Min Order',
    href: '/admin/settings#min-order',
    keywords: ['minimum', 'order value', 'mov'],
  },
  {
    id: 'settings-pins',
    label: 'PIN Codes',
    href: '/admin/settings#pins',
    keywords: ['pincode', 'serviceable', 'zip'],
  },
  {
    id: 'settings-cities',
    label: 'Cities',
    href: '/admin/settings#cities',
    keywords: ['city', 'location'],
  },
  {
    id: 'settings-delivery-slabs',
    label: 'Delivery Fees',
    href: '/admin/settings#delivery-slabs',
    keywords: ['slab', 'shipping', 'fee', 'delivery charge'],
  },
  {
    id: 'settings-whatsapp',
    label: 'WhatsApp Number',
    href: '/admin/settings#whatsapp',
    keywords: ['wa', 'phone'],
  },
  {
    id: 'settings-checkout',
    label: 'Checkout Mode',
    href: '/admin/settings#checkout',
    keywords: ['checkout', 'website', 'whatsapp order'],
  },
  {
    id: 'settings-notifications',
    label: 'Notifications',
    href: '/admin/settings#notifications',
    keywords: ['sound', 'alert'],
  },
  {
    id: 'settings-session',
    label: 'Staff Session',
    href: '/admin/settings#session',
    keywords: ['idle', 'timeout', 'logout'],
  },
  {
    id: 'settings-store-status',
    label: 'Store Status',
    href: '/admin/settings#store-status',
    keywords: ['open', 'closed', 'holiday'],
  },
  {
    id: 'settings-payments',
    label: 'Payments',
    href: '/admin/settings#payments',
    keywords: ['cod', 'upi', 'qr'],
  },
  {
    id: 'settings-wa-templates',
    label: 'WA Templates',
    href: '/admin/settings#wa-templates',
    keywords: ['template', 'message'],
  },
  {
    id: 'settings-cancellation',
    label: 'Cancellation Policy',
    href: '/admin/settings#cancellation',
    keywords: ['cancel', 'refund', 'policy'],
  },
  {
    id: 'settings-featured',
    label: 'Discovery Rails',
    href: '/admin/settings#featured',
    keywords: ['most loved', 'top discounted', 'home rails'],
  },
  {
    id: 'settings-health-star',
    label: 'Health Star',
    href: '/admin/settings#health-star',
    keywords: ['rating', 'stars'],
  },
  {
    id: 'settings-branding',
    label: 'Branding',
    href: '/admin/settings#branding',
    keywords: ['powered by', 'logo', 'seal'],
  },
  {
    id: 'settings-seasonal',
    label: 'Seasonal / 15 Aug',
    href: '/admin/settings#seasonal',
    keywords: ['independence', 'theme', 'freedom', 'promo', 'festival'],
  },
  {
    id: 'settings-promo',
    label: 'Promo Cards',
    href: '/admin/settings#promo',
    keywords: ['banner', 'hero'],
  },
  {
    id: 'settings-homepage',
    label: 'Homepage Layout',
    href: '/admin/settings#homepage',
    keywords: ['announcement', 'delivery text', 'theme color'],
  },
  {
    id: 'settings-discounts',
    label: 'Discounts & Coupons',
    href: '/admin/settings#discounts',
    keywords: ['coupon', 'membership', 'offer', 'discount'],
  },
];

const NAV_KEYWORDS: Record<string, string[]> = {
  '/admin/dashboard': ['home', 'overview', 'stats'],
  '/admin/analytics': ['reports', 'charts', 'metrics'],
  '/admin/delivery': ['rider', 'dispatch', 'desk'],
  '/admin/inventory': ['stock', 'sku', 'warehouse'],
  '/admin/finance': ['money', 'revenue', 'payout'],
  '/admin/products': ['catalog', 'items', 'sku'],
  '/admin/price-adjust': ['bulk price', 'percent', 'markup', 'increase', 'decrease'],
  '/admin/categories': ['category', 'aisle'],
  '/admin/orders': ['order', 'pending', 'delivery'],
  '/admin/whatsapp-verification': ['verify', 'wa verify', 'otp'],
  '/admin/bulk-upload': ['import', 'excel', 'csv', 'spreadsheet'],
  '/admin/staff': ['team', 'users', 'roles', 'admin'],
  '/admin/settings': ['config', 'preferences'],
  '/admin/learning': ['docs', 'guide', 'help'],
  '/admin/archive': ['history', 'old orders'],
};

/** Score how well `query` matches `haystack` via contiguous / letter subsequence. */
function matchScore(query: string, haystack: string): number {
  const q = query.trim().toLowerCase();
  const h = haystack.toLowerCase();
  if (!q) return 0;
  if (h === q) return 1000;
  if (h.startsWith(q)) return 900 - Math.min(h.length, 80);
  const idx = h.indexOf(q);
  if (idx >= 0) return 700 - idx;

  // Letter subsequence (e.g. "pda" → "Price Adjust")
  let hi = 0;
  let gaps = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    const found = h.indexOf(ch, hi);
    if (found < 0) return 0;
    gaps += found - hi;
    hi = found + 1;
  }
  return Math.max(1, 400 - gaps * 8 - (h.length - q.length));
}

function bestScore(query: string, dest: SearchDestination): number {
  const fields = [dest.label, dest.group, ...dest.keywords];
  let best = 0;
  for (const field of fields) {
    best = Math.max(best, matchScore(query, field));
  }
  return best;
}

function highlightMatch(label: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return label;
  const lower = label.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx >= 0) {
    return (
      <>
        {label.slice(0, idx)}
        <mark className="bg-amber-100 text-gray-900 rounded-sm px-0.5 not-italic font-semibold">
          {label.slice(idx, idx + q.length)}
        </mark>
        {label.slice(idx + q.length)}
      </>
    );
  }
  return label;
}

export default function AdminMasterSearch({ navItems }: { navItems: NavItem[] }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const catalog = useMemo(() => {
    const hasSettings = navItems.some((n) => n.href === '/admin/settings');
    const items: SearchDestination[] = navItems.map((n) => ({
      id: `nav-${n.href}`,
      label: n.label,
      href: n.href,
      group: 'Pages',
      keywords: NAV_KEYWORDS[n.href] ?? [],
    }));
    if (hasSettings) {
      for (const s of SETTINGS_DESTINATIONS) {
        items.push({ ...s, group: 'Settings' });
      }
    }
    return items;
  }, [navItems]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) {
      return catalog.slice(0, 8);
    }
    return catalog
      .map((dest) => ({ dest, score: bestScore(q, dest) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.dest.label.localeCompare(b.dest.label))
      .slice(0, 10)
      .map((row) => row.dest);
  }, [catalog, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const goTo = useCallback(
    (href: string) => {
      close();
      router.push(href);
      // Settings hash sections: ensure hashchange fires even on same path.
      if (href.includes('#')) {
        window.setTimeout(() => {
          window.dispatchEvent(new Event('hashchange'));
        }, 50);
      }
    },
    [close, router],
  );

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMetaK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isMetaK) {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        close();
        inputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, open]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      goTo(results[activeIndex].href);
    }
  }

  const showPanel = open && (query.trim().length > 0 || results.length > 0);

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0 max-w-xl mr-auto">
      <label className="relative block">
        <span className="sr-only">Search admin</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search pages & settings…"
          autoComplete="off"
          spellCheck={false}
          className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50/80 pl-10 pr-16 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-[border-color,box-shadow,background] focus:bg-white focus:border-blinkit-green/40 focus:ring-2 focus:ring-blinkit-green/15"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-400 shadow-sm">
          ⌘K
        </kbd>
      </label>

      {showPanel && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-40 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.45)]"
        >
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {query.trim() ? 'Matching' : 'Quick jump'}
            </p>
            <p className="text-[10px] text-gray-400 inline-flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" /> Enter
            </p>
          </div>

          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">No matches for “{query.trim()}”</p>
          ) : (
            <ul className="max-h-[min(22rem,70vh)] overflow-y-auto py-1">
              {results.map((dest, index) => {
                const active = index === activeIndex;
                return (
                  <li key={dest.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goTo(dest.href)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        active ? 'bg-blinkit-green-light/70' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          active
                            ? 'bg-blinkit-green text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {dest.label.charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-gray-900 truncate">
                          {highlightMatch(dest.label, query)}
                        </span>
                        <span className="block text-[11px] text-gray-400 truncate">
                          {dest.group}
                          {dest.href.includes('#') ? ` · ${dest.href.split('#')[1]}` : ''}
                        </span>
                      </span>
                      <ArrowRight
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-blinkit-green' : 'text-gray-300'
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
