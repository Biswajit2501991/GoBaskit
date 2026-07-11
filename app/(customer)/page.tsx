'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard/ProductCard';
import CategoryScroller from '@/components/CategoryCard/CategoryScroller';
import FloatingCartBar from '@/components/Cart/FloatingCartBar';
import { useConfigStore } from '@/store/configStore';
import { useCatalogStore } from '@/store/catalogStore';

const PRODUCT_GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2';

export default function HomePage() {
  const [activeBanner, setActiveBanner] = useState(0);
  const { homepageConfig, refreshConfig } = useConfigStore();
  const products = useCatalogStore((s) => s.products);
  const categories = useCatalogStore((s) => s.categories);
  const loaded = useCatalogStore((s) => s.loaded);
  const loading = useCatalogStore((s) => s.loading);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  // Only show skeletons on the very first load; cached data renders instantly
  // when navigating back so the screen never re-flashes.
  const showSkeleton = loading && !loaded;
  const featured = useMemo(() => products.filter((p) => p.isFeatured).slice(0, 8), [products]);
  const showFeaturedSection = homepageConfig.showBestSellers && featured.length > 0;
  // Only admin-enabled promo sections — never fall back to hardcoded banners
  // when every section is toggled off.
  const rotatingBanners = (homepageConfig.promoSections ?? [])
    .filter((section) => section.enabled)
    .map((section) => ({
      title: section.title,
      subtitle: section.subtitle,
      link: section.link,
      emoji: section.emoji || '✨',
      bg:
        section.theme === 'blue'
          ? 'from-blue-500 to-blue-700'
          : section.theme === 'orange'
            ? 'from-orange-400 to-orange-600'
            : section.theme === 'purple'
              ? 'from-purple-500 to-purple-700'
              : 'from-green-600 to-green-800',
    }));

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  useEffect(() => {
    if (rotatingBanners.length === 0) return;
    const interval = setInterval(() => setActiveBanner((b) => (b + 1) % rotatingBanners.length), 7000);
    return () => clearInterval(interval);
  }, [rotatingBanners.length]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 pb-24">
        {homepageConfig.announcementBarText && (
          <div className="mb-3 rounded-xl px-3 py-2 text-sm font-medium bg-blinkit-green-light text-blinkit-green">
            {homepageConfig.announcementBarText}
          </div>
        )}

        {homepageConfig.showHeroBanner && rotatingBanners.length > 0 && (
          <div className="mb-5 relative overflow-hidden rounded-2xl h-[156px]">
            {rotatingBanners.map((banner, i) => (
              <div
                key={`${banner.title}-${i}`}
                className={`absolute inset-0 bg-gradient-to-r ${banner.bg} rounded-2xl p-5 flex items-center justify-between transition-opacity duration-1200 ease-in-out ${
                  i === activeBanner ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
              >
                {banner.link ? (
                  <Link href={banner.link} className="flex items-center justify-between w-full h-full">
                    <div className="min-w-0 max-w-[78%]">
                      <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-1">Featured</p>
                      <h2 className="text-white font-bold text-lg">{banner.title}</h2>
                      <p className="text-white/80 text-sm mt-1 line-clamp-2">{banner.subtitle}</p>
                    </div>
                    <span className="text-5xl">{banner.emoji}</span>
                  </Link>
                ) : (
                  <>
                    <div className="min-w-0 max-w-[78%]">
                      <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-1">Featured</p>
                      <h2 className="text-white font-bold text-lg">{banner.title}</h2>
                      <p className="text-white/80 text-sm mt-1 line-clamp-2">{banner.subtitle}</p>
                    </div>
                    <span className="text-5xl">{banner.emoji}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {homepageConfig.showCategories && categories.length > 0 && (
          <CategoryScroller categories={categories} />
        )}

        {showFeaturedSection && (
          <section className="mb-6 transition-all duration-500 ease-out opacity-100 translate-y-0">
            <h2 className="font-bold text-gray-900 text-base mb-3">Best Sellers</h2>
            <div className={PRODUCT_GRID}>
              {featured.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 text-base">
              Buy groceries & essentials
            </h2>
            <span className="text-xs text-gray-400">
              {homepageConfig.deliveryTimeText} · {products.length} items
            </span>
          </div>

          {showSkeleton ? (
            <div className={PRODUCT_GRID}>
              {[...Array(12)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                  <div className="aspect-[4/5] skeleton" />
                  <div className="p-2 space-y-1.5">
                    <div className="h-2.5 skeleton rounded" />
                    <div className="h-5 skeleton rounded mt-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <span className="text-5xl mb-4 block">🔍</span>
              <p className="font-semibold text-gray-700">No products found</p>
            </div>
          ) : (
            <div className={PRODUCT_GRID}>
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </section>
      </main>

      <Footer />
      <FloatingCartBar />
    </div>
  );
}
