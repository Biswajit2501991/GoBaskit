'use client';

import { create } from 'zustand';
import type { ProductWithCategory, CategoryItem } from '@/types';

interface CatalogState {
  products: ProductWithCategory[];
  categories: CategoryItem[];
  loaded: boolean;
  loading: boolean;
  lastFetched: number;
  /** Load once per session; serves cached data instantly and revalidates in the
   *  background when stale so navigating back to a screen never shows skeletons. */
  fetchCatalog: () => Promise<void>;
  /** Force a fresh load (e.g. pull-to-refresh). */
  refreshCatalog: () => Promise<void>;
}

// TTL after which cached catalog is refreshed in the background.
const TTL_MS = 5 * 60 * 1000;

// Module-level guard so parallel mounts share a single in-flight request.
let inFlight: Promise<void> | null = null;

export const useCatalogStore = create<CatalogState>((set, get) => ({
  products: [],
  categories: [],
  loaded: false,
  loading: false,
  lastFetched: 0,

  fetchCatalog: async () => {
    const { loaded, lastFetched } = get();
    const stale = Date.now() - lastFetched > TTL_MS;

    if (loaded && !stale) return;
    if (loaded && stale) {
      // Serve cache immediately, revalidate quietly in the background.
      void load(set, false);
      return;
    }
    if (inFlight) return inFlight;
    inFlight = load(set, true);
    return inFlight;
  },

  refreshCatalog: async () => {
    if (inFlight) return inFlight;
    inFlight = load(set, false);
    return inFlight;
  },
}));

async function load(
  set: (partial: Partial<CatalogState>) => void,
  showLoading: boolean,
) {
  if (showLoading) set({ loading: true });
  try {
    const [productsRes, categoriesRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/categories'),
    ]);
    const [products, categories] = await Promise.all([
      productsRes.json(),
      categoriesRes.json(),
    ]);
    set({
      products: Array.isArray(products) ? products : [],
      categories: Array.isArray(categories) ? categories : [],
      loaded: true,
      loading: false,
      lastFetched: Date.now(),
    });
  } catch {
    set({ loading: false });
  } finally {
    inFlight = null;
  }
}

/** Case-insensitive product search across name, category, brand and variants. */
export function searchProducts(
  products: ProductWithCategory[],
  query: string,
  limit = 8,
): ProductWithCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = products.filter((p) => {
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.category?.name?.toLowerCase().includes(q)) return true;
    if (p.description?.toLowerCase().includes(q)) return true;
    return (p.variants ?? []).some(
      (v) =>
        v.brand?.toLowerCase().includes(q) ||
        v.variantName?.toLowerCase().includes(q),
    );
  });
  return matches.slice(0, limit);
}
