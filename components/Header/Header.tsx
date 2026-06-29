'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, Search, MapPin, Clock } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { STORE_NAME } from '@/constants';

interface HeaderProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
}

export default function Header({ search = '', onSearchChange, showSearch = true }: HeaderProps) {
  const pathname = usePathname();
  const hydrated = useCartHydrated();
  const itemCount = useCartStore((s) => s.getItemCount());
  const isHome = pathname === '/';

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="bg-blinkit-yellow">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link href="/" className="bg-white rounded-lg px-2.5 py-1 shadow-sm">
            <span className="font-extrabold text-xl text-gray-900 tracking-tight">
              Go<span className="text-blinkit-green">Baskit</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 bg-white/80 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-800">
              <Clock className="w-3.5 h-3.5 text-blinkit-green" />
              Delivery in 15 mins
            </div>
            <Link
              href="/cart"
              className="relative bg-white hover:bg-gray-50 rounded-lg p-2 transition-colors shadow-sm"
            >
              <ShoppingCart className="w-5 h-5 text-gray-800" />
              {hydrated && itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blinkit-green text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {isHome && showSearch && onSearchChange && (
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-3 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 bg-blinkit-green-light rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-blinkit-green" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Delivery in 15 minutes</p>
              <p className="text-sm font-bold text-gray-900 truncate">{STORE_NAME} · Groceries & Essentials</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder='Search "milk"'
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blinkit-green/30 focus:border-blinkit-green focus:bg-white"
            />
          </div>
        </div>
      )}
    </header>
  );
}
