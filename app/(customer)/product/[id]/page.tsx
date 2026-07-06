'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, ShieldCheck, Wallet, BadgePercent } from 'lucide-react';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import ProductCard from '@/components/ProductCard/ProductCard';
import FloatingCartBar from '@/components/Cart/FloatingCartBar';
import { useCartStore } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { formatCurrency, getEffectivePrice } from '@/utils/formatter';
import { resolvePublicImageUrl } from '@/utils/image';
import { CATEGORY_ICONS } from '@/constants';
import { Button } from '@/components/ui/button';
import type { ProductWithCategory } from '@/types';

export default function ProductPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<ProductWithCategory | null>(null);
  const [similar, setSimilar] = useState<ProductWithCategory[]>([]);
  const hydrated = useCartHydrated();
  const { items, addItem, updateQuantity } = useCartStore();
  const cartItem = items.find((i) => i.productId === id);
  const cartQty = hydrated ? (cartItem?.quantity ?? 0) : 0;

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((p: ProductWithCategory) => {
        setProduct(p);
        if (p?.category?.slug) {
          fetch(`/api/products?category=${p.category.slug}`)
            .then((r) => r.json())
            .then((list: ProductWithCategory[]) => setSimilar(list.filter((x) => x.id !== p.id).slice(0, 12)));
        }
      });
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showSearch={false} />
        <div className="max-w-3xl mx-auto p-8 skeleton h-96 rounded-xl mt-8" />
      </div>
    );
  }

  const price = getEffectivePrice(product.price, product.discount);
  const hasDiscount = product.discount > 0;
  const savings = hasDiscount ? Math.round((product.price - price) * 100) / 100 : 0;
  const inStock = product.stock > 0 && product.status === 'ACTIVE';
  const categoryIcon = CATEGORY_ICONS[product.category?.slug ?? ''] ?? '🛒';
  const imageUrl = resolvePublicImageUrl(product.imageUrl);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showSearch={false} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-4 pb-28">
        <nav className="text-xs text-gray-400 mb-3">
          <Link href="/" className="hover:text-blinkit-green">Home</Link>
          <span className="mx-1.5">/</span>
          {product.category?.slug && (
            <>
              <Link href={`/category/${product.category.slug}`} className="hover:text-blinkit-green">
                {product.category.name}
              </Link>
              <span className="mx-1.5">/</span>
            </>
          )}
          <span className="text-gray-600 font-medium line-clamp-1 inline">{product.name}</span>
        </nav>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden md:flex">
          <div className="relative md:w-1/2 aspect-square p-4 md:p-8">
            <div className="w-full h-full rounded-2xl overflow-hidden bg-gradient-to-br from-yellow-50 to-green-50 border border-gray-100 flex items-center justify-center">
              {imageUrl ? (
                <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-7xl">{categoryIcon}</span>
              )}
            </div>
            {hasDiscount && (
              <span className="absolute top-3 left-3 bg-blinkit-green text-white text-xs font-bold px-2 py-1 rounded-md">
                {product.discount}% OFF
              </span>
            )}
            {product.isFeatured && (
              <span className="absolute top-3 right-3 bg-blinkit-yellow text-gray-900 text-[10px] font-bold px-2 py-1 rounded-md">
                BESTSELLER
              </span>
            )}
          </div>

          <div className="p-5 space-y-3 md:w-1/2">
            {product.category?.slug && (
              <Link href={`/category/${product.category.slug}`} className="text-xs font-semibold text-blinkit-green uppercase tracking-wide">
                {product.category.name}
              </Link>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-sm text-gray-400">{product.unit}</p>

            <div className="flex items-end gap-2">
              <span className="text-2xl font-extrabold text-gray-900">{formatCurrency(price)}</span>
              {hasDiscount && (
                <>
                  <span className="text-base text-gray-400 line-through">{formatCurrency(product.price)}</span>
                  <span className="text-sm font-bold text-blinkit-green mb-0.5">Save {formatCurrency(savings)}</span>
                </>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blinkit-green bg-blinkit-green-light px-2 py-1 rounded-md">
              <Clock className="w-3.5 h-3.5" /> Delivery in 15 minutes
            </span>

            {product.description && <p className="text-gray-600 text-sm pt-1">{product.description}</p>}

            <div className="grid grid-cols-3 gap-2 pt-2">
              <Highlight icon={<Clock className="w-4 h-4" />} label="15-min delivery" />
              <Highlight icon={<Wallet className="w-4 h-4" />} label="Cash on delivery" />
              <Highlight icon={<ShieldCheck className="w-4 h-4" />} label="Quality checked" />
            </div>

            <div className="pt-2">
              {!inStock ? (
                <div className="text-sm font-semibold text-red-500 bg-red-50 rounded-lg px-3 py-2">Out of stock</div>
              ) : cartQty > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-blinkit-green rounded-lg">
                    <button onClick={() => updateQuantity(id, cartQty - 1)} className="w-10 h-10 text-white font-bold text-xl">−</button>
                    <span className="text-white font-bold w-8 text-center">{cartQty}</span>
                    <button onClick={() => updateQuantity(id, cartQty + 1)} disabled={cartQty >= product.stock} className="w-10 h-10 text-white font-bold text-xl disabled:opacity-40">+</button>
                  </div>
                  <Button asChild variant="secondary"><Link href="/cart">View Cart</Link></Button>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => addItem({ productId: product.id, name: product.name, price, unit: product.unit, imageUrl: product.imageUrl, stock: product.stock })}
                >
                  ADD TO CART
                </Button>
              )}
            </div>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <BadgePercent className="w-4 h-4 text-blinkit-green" />
              <h2 className="font-bold text-gray-900 text-base">More from {product.category?.name}</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {similar.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <FloatingCartBar />
    </div>
  );
}

function Highlight({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center bg-gray-50 rounded-lg py-2 px-1">
      <span className="text-blinkit-green">{icon}</span>
      <span className="text-[10px] font-medium text-gray-600 leading-tight">{label}</span>
    </div>
  );
}
