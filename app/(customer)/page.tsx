'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard/ProductCard';
import CategoryCard from '@/components/CategoryCard/CategoryCard';
import FloatingCartBar from '@/components/Cart/FloatingCartBar';
import { PROMO_BANNERS } from '@/constants';
import type { ProductWithCategory, CategoryItem } from '@/types';
import { useConfigStore } from '@/store/configStore';

const PRODUCT_GRID = 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2';

export default function HomePage() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [featured, setFeatured] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeBanner, setActiveBanner] = useState(0);
  const { homepageConfig, fetchConfig } = useConfigStore();
  const showFeaturedSection = !search && homepageConfig.showBestSellers && featured.length > 0;
  const homepageBanners = (homepageConfig.promoSections ?? [])
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
  const rotatingBanners = homepageBanners.length > 0 ? homepageBanners : PROMO_BANNERS.map((banner) => ({
    ...banner,
    link: '',
  }));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const [productsRes, categoriesRes, featuredRes] = await Promise.all([
        fetch(`/api/products?${params}`),
        fetch('/api/categories'),
        fetch('/api/products?featured=true'),
      ]);

      const [productsData, categoriesData, featuredData] = await Promise.all([
        productsRes.json(),
        categoriesRes.json(),
        featuredRes.json(),
      ]);

      setProducts(productsData);
      setCategories(categoriesData);
      setFeatured(featuredData.slice(0, 8));
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchData, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchData, search]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (rotatingBanners.length === 0) return;
    const interval = setInterval(() => setActiveBanner((b) => (b + 1) % rotatingBanners.length), 4500);
    return () => clearInterval(interval);
  }, [rotatingBanners.length]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header search={search} onSearchChange={setSearch} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 pb-24">
        {homepageConfig.announcementBarText && (
          <div className="mb-3 rounded-xl px-3 py-2 text-sm font-medium bg-blinkit-green-light text-blinkit-green">
            {homepageConfig.announcementBarText}
          </div>
        )}

        {!search && homepageConfig.showHeroBanner && (
          <div className="mb-5 relative overflow-hidden rounded-2xl min-h-[140px]">
            {rotatingBanners.map((banner, i) => (
              <div
                key={banner.title}
                className={`bg-gradient-to-r ${banner.bg} rounded-2xl p-5 flex items-center justify-between will-change-transform transition-all duration-700 ease-in-out ${
                  i === activeBanner
                    ? 'opacity-100 translate-x-0 scale-100 relative'
                    : 'opacity-0 absolute inset-0 translate-x-2 scale-[0.99] pointer-events-none'
                }`}
              >
                {banner.link ? (
                  <Link href={banner.link} className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-1">Featured</p>
                      <h2 className="text-white font-bold text-lg">{banner.title}</h2>
                      <p className="text-white/80 text-sm mt-1">{banner.subtitle}</p>
                    </div>
                    <span className="text-5xl">{banner.emoji}</span>
                  </Link>
                ) : (
                  <>
                    <div>
                      <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-1">Featured</p>
                      <h2 className="text-white font-bold text-lg">{banner.title}</h2>
                      <p className="text-white/80 text-sm mt-1">{banner.subtitle}</p>
                    </div>
                    <span className="text-5xl">{banner.emoji}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {homepageConfig.showCategories && categories.length > 0 && (
          <div className="mb-5 overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 pb-1">
              {categories.map((cat) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          </div>
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
              {search ? `Results for "${search}"` : 'Buy groceries & essentials'}
            </h2>
            <span className="text-xs text-gray-400">
              {homepageConfig.deliveryTimeText} · {products.length} items
            </span>
          </div>

          {loading ? (
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
