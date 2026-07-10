'use client';

import { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import ProductCard from '@/components/ProductCard/ProductCard';
import CategoryScroller from '@/components/CategoryCard/CategoryScroller';
import FloatingCartBar from '@/components/Cart/FloatingCartBar';
import { CATEGORY_ICONS } from '@/constants';
import { resolvePublicImageUrl } from '@/utils/image';
import { useCatalogStore } from '@/store/catalogStore';

const PRODUCT_GRID = 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2';

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const allProducts = useCatalogStore((s) => s.products);
  const categories = useCatalogStore((s) => s.categories);
  const loaded = useCatalogStore((s) => s.loaded);
  const loading = useCatalogStore((s) => s.loading);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const products = useMemo(
    () => allProducts.filter((p) => p.category?.slug === slug),
    [allProducts, slug],
  );
  const category = useMemo(
    () => categories.find((c) => c.slug === slug) ?? null,
    [categories, slug],
  );
  const showSkeleton = loading && !loaded;
  const categoryImage = category?.imageUrl ? resolvePublicImageUrl(category.imageUrl) : null;
  const categoryIcon = CATEGORY_ICONS[slug] || '🛒';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 pb-24">
        <nav className="text-xs text-gray-400 mb-3">
          <Link href="/" className="hover:text-blinkit-green">Home</Link>
          <span className="mx-1.5">/</span>
          <span className="text-gray-600 font-medium">{category?.name || slug}</span>
        </nav>

        <div className="mb-5 rounded-2xl bg-gradient-to-r from-green-50 to-yellow-50 border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-4xl overflow-hidden shrink-0">
            {showSkeleton ? (
              <div className="w-full h-full skeleton" aria-hidden />
            ) : categoryImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={categoryImage}
                alt={category?.name || slug}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{categoryIcon}</span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">
              {showSkeleton ? (
                <span className="inline-block h-6 w-36 skeleton rounded" />
              ) : (
                category?.name || slug
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {showSkeleton ? 'Loading…' : `${products.length} product${products.length === 1 ? '' : 's'} available`}
            </p>
          </div>
        </div>

        <CategoryScroller categories={categories} activeSlug={slug} />

        {showSkeleton ? (
          <div className={PRODUCT_GRID}>
            {[...Array(8)].map((_, i) => <div key={i} className="aspect-[4/5] skeleton rounded-lg" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <span className="text-5xl mb-3 block">🛒</span>
            <p className="font-semibold text-gray-700">No products in this category yet</p>
            <Link href="/" className="text-sm text-blinkit-green font-medium mt-2 inline-block">Browse all products →</Link>
          </div>
        ) : (
          <div className={PRODUCT_GRID}>
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>
      <Footer />
      <FloatingCartBar />
    </div>
  );
}
