'use client';

import { create } from 'zustand';
import type { StaffRole } from '@prisma/client';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants/admin';

export type AdminStaffRow = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  role: StaffRole;
  permissions: string[];
  active: boolean;
  lastLogin: string | null;
  assignedCity: string | null;
  assignedAreas: string[];
  latitude: number | null;
  longitude: number | null;
  deliveryRadius: number | null;
  shopId: string | null;
  deletedAt: string | null;
};

export type AdminShopOption = { id: string; name: string };

export type AdminStaffListParams = {
  page: number;
  pageSize?: number;
  search?: string;
};

type StaffListCache = {
  items: AdminStaffRow[];
  total: number;
  fetchedAt: number;
};

interface AdminStaffState {
  lists: Record<string, StaffListCache>;
  shops: AdminShopOption[];
  shopsFetchedAt: number;
  loadingKey: string | null;
  refreshing: boolean;

  fetchStaff: (params: AdminStaffListParams) => Promise<void>;
  /** After create/update/delete — keep the current table visible, drop other pages. */
  refreshStaff: (params: AdminStaffListParams) => Promise<void>;
  fetchShops: () => Promise<void>;
  invalidateStaff: () => void;
  invalidateShops: () => void;
}

const TTL_MS = 5 * 60 * 1000;

const inFlightLists = new Map<string, Promise<void>>();
const loadGeneration = new Map<string, number>();
let shopsInFlight: Promise<void> | null = null;

export function adminStaffListKey(params: AdminStaffListParams): string {
  return JSON.stringify({
    page: params.page,
    pageSize: params.pageSize ?? ADMIN_LIST_PAGE_SIZE,
    search: (params.search ?? '').trim(),
  });
}

export const useAdminStaffStore = create<AdminStaffState>((set, get) => ({
  lists: {},
  shops: [],
  shopsFetchedAt: 0,
  loadingKey: null,
  refreshing: false,

  fetchStaff: async (params) => {
    const key = adminStaffListKey(params);
    const cached = get().lists[key];
    const stale = !cached || Date.now() - cached.fetchedAt > TTL_MS;

    if (cached && !stale) return;

    if (cached && stale) {
      void loadStaff(set, params, key, false, false);
      return;
    }

    const existing = inFlightLists.get(key);
    if (existing) return existing;

    const promise = loadStaff(set, params, key, true, false);
    inFlightLists.set(key, promise);
    return promise;
  },

  refreshStaff: async (params) => {
    const key = adminStaffListKey(params);
    const had = Boolean(get().lists[key]);
    const promise = loadStaff(set, params, key, !had, true);
    inFlightLists.set(key, promise);
    return promise;
  },

  fetchShops: async () => {
    const { shopsFetchedAt } = get();
    const stale = Date.now() - shopsFetchedAt > TTL_MS;
    if (shopsFetchedAt && !stale) return;
    if (shopsFetchedAt && stale) {
      void loadShops(set);
      return;
    }
    if (shopsInFlight) return shopsInFlight;
    shopsInFlight = loadShops(set);
    return shopsInFlight;
  },

  invalidateStaff: () => set({ lists: {} }),
  invalidateShops: () => set({ shops: [], shopsFetchedAt: 0 }),
}));

async function loadStaff(
  set: (
    partial: Partial<AdminStaffState> | ((s: AdminStaffState) => Partial<AdminStaffState>),
  ) => void,
  params: AdminStaffListParams,
  key: string,
  showLoading: boolean,
  replaceAll: boolean,
) {
  const gen = (loadGeneration.get(key) ?? 0) + 1;
  loadGeneration.set(key, gen);

  if (showLoading) set({ loadingKey: key });
  else set({ refreshing: true });

  try {
    const pageSize = params.pageSize ?? ADMIN_LIST_PAGE_SIZE;
    const qs = new URLSearchParams({
      page: String(params.page),
      pageSize: String(pageSize),
    });
    if (params.search?.trim()) qs.set('search', params.search.trim());

    const res = await fetch(`/api/admin/staff?${qs}`);
    if (loadGeneration.get(key) !== gen) return;

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
    if (loadGeneration.get(key) !== gen) return;

    const items: AdminStaffRow[] = Array.isArray(data.items) ? data.items : [];
    const total = typeof data.total === 'number' ? data.total : 0;
    const next: StaffListCache = { items, total, fetchedAt: Date.now() };

    set((state) => ({
      lists: replaceAll ? { [key]: next } : { ...state.lists, [key]: next },
    }));
  } catch {
    if (loadGeneration.get(key) !== gen) return;
    set((state) => ({
      lists: {
        ...state.lists,
        [key]: state.lists[key] ?? { items: [], total: 0, fetchedAt: Date.now() },
      },
    }));
  } finally {
    if (loadGeneration.get(key) === gen) {
      set({ loadingKey: null, refreshing: false });
      inFlightLists.delete(key);
    }
  }
}

async function loadShops(
  set: (partial: Partial<AdminStaffState>) => void,
) {
  try {
    const res = await fetch('/api/admin/shops', { cache: 'no-store' });
    if (!res.ok) {
      set({ shopsFetchedAt: Date.now() });
      return;
    }
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    set({
      shops: items.map((shop: { id: string; name: string }) => ({
        id: shop.id,
        name: shop.name,
      })),
      shopsFetchedAt: Date.now(),
    });
  } catch {
    /* keep previous */
  } finally {
    shopsInFlight = null;
  }
}
