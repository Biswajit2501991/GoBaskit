'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Clock, ShieldCheck, Wallet, BadgePercent } from 'lucide-react';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import ProductCard from '@/components/ProductCard/ProductCard';
import FloatingCartBar from '@/components/Cart/FloatingCartBar';
import { useCartStore, cartLineKey } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { useCartUiStore } from '@/store/cartUiStore';
import { useProductVariants } from '@/hooks/useProductVariants';
import { useCatalogStore } from '@/store/catalogStore';
import { formatCurrency } from '@/utils/formatter';
import { getListPrice } from '@/utils/pricing';
import { sizedImageUrl } from '@/utils/image';
import { preloadImages } from '@/utils/imagePreload';
import DiscountBadge from '@/components/Product/DiscountBadge';
import BestsellerBadge from '@/components/Product/BestsellerBadge';
import HealthStarRating from '@/components/Product/HealthStarRating';
import HealthStarBadge from '@/components/Product/HealthStarBadge';
import ZoomImage from '@/components/Product/ZoomImage';
import ProductDetailsAccordion from '@/components/Product/ProductDetailsAccordion';
import { addOptionToCart } from '@/components/Product/VariantSelector';
import { CATEGORY_ICONS } from '@/constants';
import { Button } from '@/components/ui/button';
import { useConfigStore } from '@/store/configStore';
import { DEFAULT_HEALTH_STAR_DISPLAY } from '@/constants/healthStarDisplay';
import type { ProductWithCategory } from '@/types';

export default function ProductPage() {
  const params = useParams();
  const id = params.id as string;
  const [selectedKey, setSelectedKey] = useState<string>('base');
  const hydrated = useCartHydrated();
  const { items, addItem, updateQuantity } = useCartStore();
  const openCart = useCartUiStore((s) => s.openCart);
  const showHealthStarRating = useConfigStore((s) => s.homepageConfig.showHealthStarRating !== false);
  const healthStarDisplay = useConfigStore(
    (s) => s.homepageConfig.healthStarDisplay ?? DEFAULT_HEALTH_STAR_DISPLAY,
  );
  const fetchConfig = useConfigStore((s) => s.fetchConfig);

  const catalogProducts = useCatalogStore((s) => s.products);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  // `fetched` is keyed by id so a stale fetch never leaks onto a new product.
  const [fetched, setFetched] = useState<{ id: string; product: ProductWithCategory } | null>(null);

  const cached = useMemo(
    () => catalogProducts.find((p) => p.id === id) ?? null,
    [catalogProducts, id],
  );
  // Show the cached product instantly (from the session catalog); the fresh
  // fetch then reconciles prices/stock without a loading flash on navigation.
  const product = (fetched?.id === id ? fetched.product : null) ?? cached;

  useEffect(() => {
    fetchCatalog();
    fetchConfig();
  }, [fetchCatalog, fetchConfig]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((p: ProductWithCategory) => {
        if (!cancelled && p?.id) setFetched({ id, product: p });
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [id]);

  const similar = useMemo(() => {
    const slug = product?.category?.slug;
    if (!slug) return [];
    return catalogProducts
      .filter((p) => p.category?.slug === slug && p.id !== product?.id)
      .slice(0, 12);
  }, [catalogProducts, product]);

  const { variants, options, showOptions } = useProductVariants(product);
  const selected = useMemo(
    () => options.find((o) => o.key === selectedKey) ?? options[0] ?? null,
    [options, selectedKey],
  );

  // Preload every option image up-front (at detail size) so switching options
  // is instant with no flicker.
  useEffect(() => {
    if (!product) return;
    preloadImages([
      sizedImageUrl(product.imageUrl, 900),
      ...(product.variants ?? []).map((v) => sizedImageUrl(v.imageUrl, 900)),
    ]);
  }, [product]);

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-3xl mx-auto p-8 skeleton h-96 rounded-xl mt-8" />
      </div>
    );
  }

  // Display values come from the selected option (parent or variant) when the
  // product has options, otherwise straight from the product itself.
  const active = showOptions && selected ? selected : null;
  const sellingPrice = active ? active.price : product.price;
  const displayMrp = active ? active.mrp : product.actualPrice ?? null;
  const listPrice = getListPrice(displayMrp, sellingPrice);
  const savings = listPrice ? Math.round((listPrice - sellingPrice) * 100) / 100 : 0;
  const effectiveStock = active ? active.stock : product.stock;
  const inStock = active ? active.inStock : product.stock > 0 && product.status === 'ACTIVE';

  const selectedVariantId = active?.variantId ?? null;
  const lineKey = cartLineKey(product.id, selectedVariantId);
  const cartItem = items.find((i) => cartLineKey(i.productId, i.variantId) === lineKey);
  const cartQty = hydrated ? (cartItem?.quantity ?? 0) : 0;

  const categoryIcon = CATEGORY_ICONS[product.category?.slug ?? ''] ?? '🛒';
  const imageUrl = sizedImageUrl(active ? active.imageUrl : product.imageUrl, 900);
  const unitLabel = active ? active.sizeLabel || product.unit : product.unit;
  const detailHealthRating = (() => {
    if (!showHealthStarRating) return null;
    const r = active?.healthStarRating ?? product.healthStarRating;
    return typeof r === 'number' && r >= 1 && r <= 5 ? r : null;
  })();
  const showDetailBadge =
    detailHealthRating != null &&
    detailHealthRating >= (healthStarDisplay.badgeMinRating ?? 5) &&
    (healthStarDisplay.mode === 'badge' || healthStarDisplay.mode === 'both') &&
    Boolean(healthStarDisplay.badgeUrl);
  const showDetailStars =
    detailHealthRating != null &&
    (healthStarDisplay.mode === 'stars' || healthStarDisplay.mode === 'both');

  function addSelected() {
    if (active) {
      addOptionToCart(addItem, product!, active, variants);
    } else {
      addItem({
        productId: product!.id,
        name: product!.name,
        price: product!.price,
        mrp: product!.actualPrice ?? null,
        unit: product!.unit,
        imageUrl: product!.imageUrl,
        stock: product!.stock,
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
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
          <div className="md:w-1/2 aspect-square p-4 md:p-8">
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-gradient-to-br from-yellow-50 to-green-50 border border-gray-100 flex items-center justify-center">
              {imageUrl ? (
                <ZoomImage src={imageUrl} alt={product.name} className="w-full h-full" />
              ) : (
                <span className="text-7xl">{categoryIcon}</span>
              )}
              {product.isFeatured && (
                <BestsellerBadge className="absolute top-2 left-2 z-10 text-[10px] px-2 py-1" />
              )}
              {showDetailBadge && (
                <HealthStarBadge
                  url={healthStarDisplay.badgeUrl}
                  position={healthStarDisplay.badgePosition}
                  size={36}
                />
              )}
            </div>
          </div>

          <div className="p-5 space-y-3 md:w-1/2">
            {product.category?.slug && (
              <Link href={`/category/${product.category.slug}`} className="text-xs font-semibold text-blinkit-green uppercase tracking-wide">
                {product.category.name}
              </Link>
            )}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              {showDetailStars && (
                <HealthStarRating
                  rating={detailHealthRating}
                  variant="inline"
                  className="shrink-0 mt-1"
                />
              )}
            </div>
            {active && !active.isBase ? (
              <p className="text-sm text-gray-600 font-medium">{active.name}</p>
            ) : null}
            <p className="text-sm text-gray-400">{unitLabel}</p>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl font-bold text-gray-900 leading-none">{formatCurrency(sellingPrice)}</span>
                {listPrice ? (
                  <span className="text-base text-gray-400 leading-none">
                    MRP <span className="line-through">{formatCurrency(listPrice)}</span>
                  </span>
                ) : null}
                <DiscountBadge mrp={displayMrp} price={sellingPrice} size="sm" />
              </div>
              {listPrice ? (
                <span className="block text-sm font-bold text-blinkit-green">Save {formatCurrency(savings)}</span>
              ) : null}
              <span className="block text-[11px] text-gray-400">Inclusive of all taxes</span>
            </div>

            {showOptions && options.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {options.map((o) => {
                  const isActive = selected?.key === o.key;
                  const out = !o.inStock;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      disabled={out}
                      onClick={() => setSelectedKey(o.key)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        isActive
                          ? 'border-blinkit-green bg-blinkit-green-light text-blinkit-green'
                          : out
                            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed line-through'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-blinkit-green/50'
                      }`}
                    >
                      {o.isBase ? (o.sizeLabel || 'Base') : (o.sizeLabel || o.name)}
                    </button>
                  );
                })}
              </div>
            )}

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
                    <button onClick={() => updateQuantity(lineKey, cartQty - 1)} className="w-10 h-10 text-white font-bold text-xl">−</button>
                    <span className="text-white font-bold w-8 text-center">{cartQty}</span>
                    <button onClick={() => updateQuantity(lineKey, cartQty + 1)} disabled={cartQty >= effectiveStock} className="w-10 h-10 text-white font-bold text-xl disabled:opacity-40">+</button>
                  </div>
                  <Button type="button" variant="secondary" onClick={openCart}>
                    View Cart
                  </Button>
                </div>
              ) : (
                <Button size="lg" className="w-full" onClick={addSelected}>
                  ADD TO CART
                </Button>
              )}
            </div>
          </div>
        </div>

        <ProductDetailsAccordion details={active?.details ?? product.details ?? ''} />

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
