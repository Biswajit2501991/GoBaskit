'use client';

import { create } from 'zustand';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants/admin';
import type { AdminCategory, AdminProduct } from '@/types/admin';

export type { AdminCategory, AdminProduct };

export type AdminProductListParams = {
  page: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  sort?: 'name' | 'stock';
};

type ProductListCache = {
  items: AdminProduct[];
  total: number;
  fetchedAt: number;
};

interface AdminProductsState {
  /** Cached product pages keyed by filter/page/sort. */
  lists: Record<string, ProductListCache>;
  categories: AdminCategory[];
  categoriesFetchedAt: number;
  /** True only while the first load for a key has no cache yet. */
  loadingKey: string | null;
  /** Background refresh in progress (does not blank the table). */
  refreshing: boolean;

  listKey: (params: AdminProductListParams) => string;
  getCachedList: (params: AdminProductListParams) => ProductListCache | null;
  fetchProducts: (params: AdminProductListParams) => Promise<void>;
  /** Force refresh current filters (after create/update/delete). */
  refreshProducts: (params: AdminProductListParams) => Promise<void>;
  fetchCategories: () => Promise<void>;
  setCategories: (categories: AdminCategory[]) => void;
  invalidateProducts: () => void;
  invalidateCategories: () => void;
}

const TTL_MS = 5 * 60 * 1000;

const inFlightLists = new Map<string, Promise<void>>();
let categoriesInFlight: Promise<void> | null = null;

export function adminProductListKey(params: AdminProductListParams): string {
  return JSON.stringify({
    page: params.page,
    pageSize: params.pageSize ?? ADMIN_LIST_PAGE_SIZE,
    search: (params.search ?? '').trim(),
    categoryId: params.categoryId ?? '',
    sort: params.sort ?? 'name',
  });
}

export const useAdminProductsStore = create<AdminProductsState>((set, get) => ({
  lists: {},
  categories: [],
  categoriesFetchedAt: 0,
  loadingKey: null,
  refreshing: false,

  listKey: adminProductListKey,

  getCachedList: (params) => {
    const key = adminProductListKey(params);
    return get().lists[key] ?? null;
  },

  fetchProducts: async (params) => {
    const key = adminProductListKey(params);
    const cached = get().lists[key];
    const stale = !cached || Date.now() - cached.fetchedAt > TTL_MS;

    if (cached && !stale) return;

    if (cached && stale) {
      // Instant paint from cache; quiet background refresh.
      void loadProducts(set, get, params, key, false);
      return;
    }

    const existing = inFlightLists.get(key);
    if (existing) return existing;

    const promise = loadProducts(set, get, params, key, true);
    inFlightLists.set(key, promise);
    return promise;
  },

  refreshProducts: async (params) => {
    const key = adminProductListKey(params);
    // Drop all list pages so filters/pages don't show stale rows after mutations.
    set({ lists: {} });
    const promise = loadProducts(set, get, params, key, false);
    inFlightLists.set(key, promise);
    return promise;
  },

  fetchCategories: async () => {
    const { categories, categoriesFetchedAt } = get();
    const stale = Date.now() - categoriesFetchedAt > TTL_MS;
    if (categories.length && !stale) return;
    if (categories.length && stale) {
      void loadCategories(set, false);
      return;
    }
    if (categoriesInFlight) return categoriesInFlight;
    categoriesInFlight = loadCategories(set, true);
    return categoriesInFlight;
  },

  setCategories: (categories) =>
    set({ categories, categoriesFetchedAt: Date.now() }),

  invalidateProducts: () => set({ lists: {} }),

  invalidateCategories: () =>
    set({ categories: [], categoriesFetchedAt: 0 }),
}));

async function loadProducts(
  set: (partial: Partial<AdminProductsState> | ((s: AdminProductsState) => Partial<AdminProductsState>)) => void,
  get: () => AdminProductsState,
  params: AdminProductListParams,
  key: string,
  showLoading: boolean,
) {
  if (showLoading) set({ loadingKey: key });
  else set({ refreshing: true });

  try {
    const pageSize = params.pageSize ?? ADMIN_LIST_PAGE_SIZE;
    const qs = new URLSearchParams({
      page: String(params.page),
      pageSize: String(pageSize),
      sort: params.sort ?? 'name',
    });
    if (params.search?.trim()) qs.set('search', params.search.trim());
    if (params.categoryId) qs.set('categoryId', params.categoryId);

    // Bundle categories on first load when we don't have them yet.
    if (get().categories.length === 0) {
      qs.set('includeCategories', '1');
    }

    const res = await fetch(`/api/admin/products?${qs}`);
    if (!res.ok) {
      set((state) => ({
        lists: {
          ...state.lists,
          [key]: state.lists[key] ?? { items: [], total: 0, fetchedAt: Date.now() },
        },
      }));
      return;
    }

    const data = await res.json();
    const items: AdminProduct[] = Array.isArray(data.items) ? data.items : [];
    const total = typeof data.total === 'number' ? data.total : 0;

    set((state) => ({
      lists: {
        ...state.lists,
        [key]: { items, total, fetchedAt: Date.now() },
      },
      ...(Array.isArray(data.categories) && data.categories.length
        ? { categories: data.categories as AdminCategory[], categoriesFetchedAt: Date.now() }
        : {}),
    }));
  } catch {
    set((state) => ({
      lists: {
        ...state.lists,
        [key]: state.lists[key] ?? { items: [], total: 0, fetchedAt: Date.now() },
      },
    }));
  } finally {
    set({ loadingKey: null, refreshing: false });
    inFlightLists.delete(key);
  }
}

async function loadCategories(
  set: (partial: Partial<AdminProductsState>) => void,
  _showLoading: boolean,
) {
  try {
    const collected: AdminCategory[] = [];
    let pageNum = 1;
    let total = 0;
    const pageSize = 100;

    do {
      const params = new URLSearchParams({
        page: String(pageNum),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/admin/categories?${params}`);
      if (!res.ok) break;
      const data = await res.json();
      const items: AdminCategory[] = Array.isArray(data.items) ? data.items : [];
      total = typeof data.total === 'number' ? data.total : items.length;
      collected.push(...items);
      if (items.length < pageSize || collected.length >= total) break;
      pageNum += 1;
    } while (pageNum <= 20);

    set({ categories: collected, categoriesFetchedAt: Date.now() });
  } catch {
    /* keep previous */
  } finally {
    categoriesInFlight = null;
  }
}
