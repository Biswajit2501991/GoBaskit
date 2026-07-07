'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X, Search } from 'lucide-react';
import { CATEGORY_ICONS } from '@/constants';
import { resolvePublicImageUrl } from '@/utils/image';
import type { CategoryItem } from '@/types';

interface AllCategoriesModalProps {
  open: boolean;
  categories: CategoryItem[];
  activeSlug?: string;
  onClose: () => void;
}

export default function AllCategoriesModal({
  open,
  categories,
  activeSlug,
  onClose,
}: AllCategoriesModalProps) {
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      if (open) {
        setQuery('');
        setMounted(true);
        requestAnimationFrame(() => setEntered(true));
      } else {
        setEntered(false);
        exitTimer = setTimeout(() => setMounted(false), 200);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`relative bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col transition-transform duration-200 ${
          entered ? 'translate-y-0' : 'translate-y-6 sm:translate-y-4'
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-base font-bold text-gray-900">All Categories</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blinkit-green/30 focus:border-blinkit-green focus:bg-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-5">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-10">
              No categories found for “{query.trim()}”.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {filtered.map((cat) => {
                const icon = CATEGORY_ICONS[cat.slug] || '🏪';
                const active = cat.slug === activeSlug;
                return (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    onClick={onClose}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div
                      className={`w-full aspect-square rounded-2xl flex items-center justify-center text-3xl border transition-all overflow-hidden ${
                        active
                          ? 'border-blinkit-green ring-2 ring-blinkit-green/30 bg-blinkit-green-light'
                          : 'border-gray-100 bg-gradient-to-br from-yellow-50 to-green-50 group-hover:border-blinkit-green/40 group-hover:shadow-sm'
                      }`}
                    >
                      {cat.imageUrl ? (
                        <img
                          src={resolvePublicImageUrl(cat.imageUrl)}
                          alt={cat.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="transition-transform group-hover:scale-110">{icon}</span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-semibold text-center leading-tight line-clamp-2 ${
                        active ? 'text-blinkit-green' : 'text-gray-700'
                      }`}
                    >
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
