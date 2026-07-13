'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useCatalogStore, searchProducts } from '@/store/catalogStore';
import { sizedImageUrl } from '@/utils/image';
import { formatCurrency } from '@/utils/formatter';
import { CATEGORY_ICONS } from '@/constants';
import { useProductVariants } from '@/hooks/useProductVariants';
import type { ProductWithCategory } from '@/types';

const DROPDOWN_LIMIT = 8;

function ResultRow({ product, onPick }: { product: ProductWithCategory; onPick: () => void }) {
  const { showOptions, fromPrice } = useProductVariants(product);
  const imageUrl = sizedImageUrl(product.imageUrl, 96);
  const price = showOptions && fromPrice != null ? fromPrice : product.price;

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
    >
      <div className="w-11 h-11 rounded-lg overflow-hidden bg-gradient-to-br from-yellow-50 to-green-50 border border-gray-100 flex-shrink-0 flex items-center justify-center">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={product.name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg">{CATEGORY_ICONS[product.category?.slug ?? ''] ?? '🛒'}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
        <p className="text-xs text-gray-400 truncate">{product.category?.name ?? product.unit}</p>
      </div>
      <div className="text-sm font-bold text-gray-900 shrink-0">
        {showOptions ? <span className="text-[10px] font-medium text-gray-400 mr-1">from</span> : null}
        {formatCurrency(price)}
      </div>
    </button>
  );
}

export default function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = pathname === '/search' ? (searchParams.get('q') ?? '') : '';
  const [query, setQuery] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const products = useCatalogStore((s) => s.products);
  const loading = useCatalogStore((s) => s.loading);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    if (pathname === '/search') {
      setQuery(urlQuery);
    }
  }, [pathname, urlQuery]);

  // Live-update /search results as the user types in the sticky bar.
  useEffect(() => {
    if (pathname !== '/search') return;
    const trimmedLocal = query.trim();
    if (trimmedLocal === urlQuery.trim()) return;
    const timer = window.setTimeout(() => {
      router.replace(trimmedLocal ? `/search?q=${encodeURIComponent(trimmedLocal)}` : '/search');
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, pathname, urlQuery, router]);

  // Close the dropdown whenever the route changes (e.g. after picking a result).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const results = useMemo(
    () => searchProducts(products, query, DROPDOWN_LIMIT),
    [products, query],
  );
  const hasMore = useMemo(
    () => searchProducts(products, query, DROPDOWN_LIMIT + 1).length > DROPDOWN_LIMIT,
    [products, query],
  );
  const trimmed = query.trim();
  const showDropdown = open && trimmed.length > 0 && pathname !== '/search';
  const searchHref = `/search?q=${encodeURIComponent(trimmed)}`;

  function pick(id: string) {
    setOpen(false);
    router.push(`/product/${id}`);
  }

  function goToSearch() {
    if (!trimmed) return;
    setOpen(false);
    router.push(searchHref);
  }

  return (
    <div ref={containerRef} className="relative">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          goToSearch();
        }}
      >
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search for products, brands and more"
          enterKeyHint="search"
          className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blinkit-green/30 focus:border-blinkit-green focus:bg-white"
          aria-label="Search products"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
              if (pathname === '/search') router.push('/search');
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto">
          {results.length > 0 ? (
            <>
              <div className="divide-y divide-gray-50">
                {results.map((p) => (
                  <ResultRow key={p.id} product={p} onPick={() => pick(p.id)} />
                ))}
              </div>
              <Link
                href={searchHref}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm font-semibold text-blinkit-green bg-gray-50 hover:bg-blinkit-green-light border-t border-gray-100 text-center"
              >
                {hasMore ? 'See all results' : 'View all matching products'}
              </Link>
            </>
          ) : loading ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Searching…</p>
          ) : (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">
              No products found for “{trimmed}”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
