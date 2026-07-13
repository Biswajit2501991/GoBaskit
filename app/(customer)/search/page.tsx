'use client';

import { Suspense, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import ProductCard from '@/components/ProductCard/ProductCard';
import FloatingCartBar from '@/components/Cart/FloatingCartBar';
import { useCatalogStore, searchProducts } from '@/store/catalogStore';

const PRODUCT_GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2';
const SEARCH_LIMIT = 200;

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const products = useCatalogStore((s) => s.products);
  const categories = useCatalogStore((s) => s.categories);
  const loaded = useCatalogStore((s) => s.loaded);
  const loading = useCatalogStore((s) => s.loading);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  const showSkeleton = loading && !loaded;
  const trimmed = q.trim();

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const results = useMemo(
    () => (trimmed ? searchProducts(products, trimmed, SEARCH_LIMIT) : []),
    [products, trimmed],
  );

  return (
    <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 pb-24">
      <nav className="text-xs text-gray-400 mb-3">
        <Link href="/" className="hover:text-blinkit-green">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-600 font-medium">Search</span>
      </nav>

      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900">
          {trimmed ? (
            <>
              Results for “{trimmed}”
            </>
          ) : (
            'Search products'
          )}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {showSkeleton
            ? 'Loading…'
            : trimmed
              ? `${results.length} product${results.length === 1 ? '' : 's'} found`
              : 'Type in the search bar above to find groceries and essentials'}
        </p>
      </div>

      {!trimmed ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <span className="text-5xl mb-3 block">🔎</span>
          <p className="font-semibold text-gray-700">Start typing to search</p>
          <p className="text-sm text-gray-500 mt-1">Try milk, bread, snacks, or a brand name</p>
          {categories[0] && (
            <Link
              href={`/category/${categories[0].slug}`}
              className="text-sm text-blinkit-green font-medium mt-3 inline-block"
            >
              Or browse categories →
            </Link>
          )}
        </div>
      ) : showSkeleton ? (
        <div className={PRODUCT_GRID}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-[4/5] skeleton rounded-lg" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <span className="text-5xl mb-3 block">🛒</span>
          <p className="font-semibold text-gray-700">No products found for “{trimmed}”</p>
          <Link href="/" className="text-sm text-blinkit-green font-medium mt-2 inline-block">
            Back to home →
          </Link>
        </div>
      ) : (
        <div className={PRODUCT_GRID}>
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <Suspense
        fallback={
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 pb-24">
            <div className="h-7 w-48 skeleton rounded mb-2" />
            <div className="h-4 w-32 skeleton rounded mb-5" />
            <div className={PRODUCT_GRID}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[4/5] skeleton rounded-lg" />
              ))}
            </div>
          </main>
        }
      >
        <SearchResults />
      </Suspense>
      <Footer />
      <FloatingCartBar />
    </div>
  );
}
