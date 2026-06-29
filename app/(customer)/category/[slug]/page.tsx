'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import ProductCard from '@/components/ProductCard/ProductCard';
import CategoryCard from '@/components/CategoryCard/CategoryCard';
import FloatingCartBar from '@/components/Cart/FloatingCartBar';
import type { ProductWithCategory, CategoryItem } from '@/types';

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [category, setCategory] = useState<CategoryItem | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [productsRes, categoriesRes] = await Promise.all([
        fetch(`/api/products?category=${slug}`),
        fetch('/api/categories'),
      ]);
      const [productsData, categoriesData] = await Promise.all([productsRes.json(), categoriesRes.json()]);
      setProducts(productsData);
      setCategories(categoriesData);
      setCategory(categoriesData.find((c: CategoryItem) => c.slug === slug) || null);
      setLoading(false);
    }
    load();
  }, [slug]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showSearch={false} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 pb-24">
        <h1 className="text-xl font-bold mb-4">{category?.name || slug}</h1>

        <div className="mb-5 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-1">
            {categories.map((cat) => (
              <CategoryCard key={cat.id} category={cat} active={cat.slug === slug} />
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[...Array(8)].map((_, i) => <div key={i} className="aspect-square skeleton rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>
      <Footer />
      <FloatingCartBar />
    </div>
  );
}
