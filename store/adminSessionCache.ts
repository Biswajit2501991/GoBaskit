'use client';

import { create } from 'zustand';

export type AdminCacheEntry<T = unknown> = {
  data: T;
  fetchedAt: number;
  dirty: boolean;
};

type AdminSessionState = {
  entries: Record<string, AdminCacheEntry>;
  setEntry: (key: string, data: unknown) => void;
  updateEntry: (key: string, data: unknown) => void;
  markDirty: (prefix: string) => void;
  invalidate: (prefix?: string) => void;
};

export const DEFAULT_ADMIN_QUERY_STALE_MS = 5 * 60 * 1000;

export const useAdminSessionStore = create<AdminSessionState>((set) => ({
  entries: {},

  setEntry: (key, data) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [key]: { data, fetchedAt: Date.now(), dirty: false },
      },
    })),

  updateEntry: (key, data) =>
    set((state) => {
      const current = state.entries[key];
      if (!current) return state;
      return {
        entries: {
          ...state.entries,
          [key]: { ...current, data },
        },
      };
    }),

  markDirty: (prefix) =>
    set((state) => {
      const entries = { ...state.entries };
      let changed = false;
      for (const key of Object.keys(entries)) {
        if (!key.startsWith(prefix) || entries[key].dirty) continue;
        entries[key] = { ...entries[key], dirty: true };
        changed = true;
      }
      return changed ? { entries } : state;
    }),

  invalidate: (prefix) =>
    set((state) => {
      if (!prefix) return { entries: {} };
      const entries = { ...state.entries };
      for (const key of Object.keys(entries)) {
        if (key.startsWith(prefix)) delete entries[key];
      }
      return { entries };
    }),
}));

const inFlight = new Map<string, Promise<void>>();
const loadGeneration = new Map<string, number>();

export function peekAdminQuery<T>(key: string): AdminCacheEntry<T> | undefined {
  return useAdminSessionStore.getState().entries[key] as AdminCacheEntry<T> | undefined;
}

export async function ensureAdminQuery<T>(
  key: string,
  loader: () => Promise<T>,
  opts?: { staleTime?: number; force?: boolean },
): Promise<void> {
  const staleTime = opts?.staleTime ?? DEFAULT_ADMIN_QUERY_STALE_MS;
  const cached = peekAdminQuery<T>(key);
  const stale = !cached || Date.now() - cached.fetchedAt > staleTime;
  const needsNetwork = opts?.force || !cached || cached.dirty || stale;

  if (!needsNetwork) return;

  if (cached && !opts?.force) {
    void runLoader(key, loader);
    return;
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = runLoader(key, loader);
  inFlight.set(key, promise);
  return promise;
}

async function runLoader<T>(key: string, loader: () => Promise<T>): Promise<void> {
  const gen = (loadGeneration.get(key) ?? 0) + 1;
  loadGeneration.set(key, gen);
  try {
    const data = await loader();
    if (loadGeneration.get(key) !== gen) return;
    useAdminSessionStore.getState().setEntry(key, data);
  } catch {
    /* keep previous snapshot */
  } finally {
    if (loadGeneration.get(key) === gen) {
      inFlight.delete(key);
    }
  }
}
