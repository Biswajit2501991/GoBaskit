'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useCatalogStore, searchProducts } from '@/store/catalogStore';
import { resolvePublicImageUrl } from '@/utils/image';
import { formatCurrency } from '@/utils/formatter';
import { CATEGORY_ICONS } from '@/constants';
import { useProductVariants } from '@/hooks/useProductVariants';
import type { ProductWithCategory } from '@/types';

function ResultRow({ product, onPick }: { product: ProductWithCategory; onPick: () => void }) {
  const { showOptions, fromPrice } = useProductVariants(product);
  const imageUrl = resolvePublicImageUrl(product.imageUrl);
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
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const products = useCatalogStore((s) => s.products);
  const loading = useCatalogStore((s) => s.loading);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

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

  const results = useMemo(() => searchProducts(products, query), [products, query]);
  const trimmed = query.trim();
  const showDropdown = open && trimmed.length > 0;

  function pick(id: string) {
    setOpen(false);
    router.push(`/product/${id}`);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search for products, brands and more"
          className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blinkit-green/30 focus:border-blinkit-green focus:bg-white"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto">
          {results.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {results.map((p) => (
                <ResultRow key={p.id} product={p} onPick={() => pick(p.id)} />
              ))}
            </div>
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
