import { prisma } from '@/lib/prisma';
import {
  SERVICEABLE_PINS,
  DELIVERY_SLABS,
  MIN_ORDER_VALUE,
  SLAB_MAX,
  type DeliverySlab,
} from '@/constants';

export interface StoreConfig {
  serviceablePins: string[];
  deliverySlabs: DeliverySlab[];
  minOrderValue: number;
}

const KEY_PINS = 'serviceable_pins';
const KEY_SLABS = 'delivery_slabs';
const KEY_MIN = 'min_order_value';

const DEFAULTS: StoreConfig = {
  serviceablePins: SERVICEABLE_PINS,
  deliverySlabs: DELIVERY_SLABS,
  minOrderValue: MIN_ORDER_VALUE,
};

// In-memory cache. The app runs as a single long-lived Node server, so this
// keeps DB reads for settings to at most one per TTL window (plus a refresh
// right after an admin save, which invalidates the cache).
const TTL_MS = 5 * 60 * 1000;
let cache: { data: StoreConfig; expiresAt: number } | null = null;

function toStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return null;
}

function toSlabs(value: unknown): DeliverySlab[] | null {
  if (!Array.isArray(value)) return null;
  const slabs = value
    .map((s) => ({
      min: Number((s as DeliverySlab).min),
      max: Number((s as DeliverySlab).max),
      charge: Number((s as DeliverySlab).charge),
    }))
    .filter((s) => Number.isFinite(s.min) && Number.isFinite(s.max) && Number.isFinite(s.charge));
  return slabs.length ? slabs.sort((a, b) => a.min - b.min) : null;
}

function parseRows(rows: { key: string; value: string }[]): StoreConfig {
  const map = new Map(rows.map((r) => [r.key, r.value]));

  let pins = DEFAULTS.serviceablePins;
  const rawPins = map.get(KEY_PINS);
  if (rawPins) {
    try {
      pins = toStringArray(JSON.parse(rawPins)) ?? pins;
    } catch {
      pins = rawPins.split(',').map((p) => p.trim()).filter(Boolean);
    }
  }

  let slabs = DEFAULTS.deliverySlabs;
  const rawSlabs = map.get(KEY_SLABS);
  if (rawSlabs) {
    try {
      slabs = toSlabs(JSON.parse(rawSlabs)) ?? slabs;
    } catch {
      /* keep default */
    }
  }

  let minOrderValue = DEFAULTS.minOrderValue;
  const rawMin = map.get(KEY_MIN);
  if (rawMin != null && rawMin !== '') {
    const n = Number(rawMin);
    if (Number.isFinite(n) && n >= 0) minOrderValue = n;
  }

  return { serviceablePins: pins, deliverySlabs: slabs, minOrderValue };
}

export const SettingsService = {
  /** Cached read of the store config. Hits the DB at most once per TTL. */
  async getStoreConfig(): Promise<StoreConfig> {
    if (cache && cache.expiresAt > Date.now()) return cache.data;
    try {
      const rows = await prisma.setting.findMany({
        where: { key: { in: [KEY_PINS, KEY_SLABS, KEY_MIN] } },
        select: { key: true, value: true },
      });
      const data = parseRows(rows);
      cache = { data, expiresAt: Date.now() + TTL_MS };
      return data;
    } catch {
      // On DB error, serve last-known cache or defaults; never throw.
      return cache?.data ?? DEFAULTS;
    }
  },

  /** Persist changed settings and invalidate the cache. */
  async updateStoreConfig(partial: Partial<StoreConfig>): Promise<StoreConfig> {
    const writes: Promise<unknown>[] = [];

    if (partial.serviceablePins) {
      const pins = partial.serviceablePins
        .map((p) => String(p).trim())
        .filter((p) => /^\d{6}$/.test(p));
      writes.push(upsert(KEY_PINS, JSON.stringify([...new Set(pins)])));
    }
    if (partial.deliverySlabs) {
      const slabs = partial.deliverySlabs
        .map((s) => ({
          min: Math.max(0, Math.round(Number(s.min))),
          max: Math.min(SLAB_MAX, Math.round(Number(s.max))),
          charge: Math.max(0, Number(s.charge)),
        }))
        .filter((s) => Number.isFinite(s.min) && Number.isFinite(s.max) && Number.isFinite(s.charge))
        .sort((a, b) => a.min - b.min);
      writes.push(upsert(KEY_SLABS, JSON.stringify(slabs)));
    }
    if (partial.minOrderValue != null && Number.isFinite(partial.minOrderValue)) {
      writes.push(upsert(KEY_MIN, String(Math.max(0, Math.round(partial.minOrderValue)))));
    }

    await Promise.all(writes);
    cache = null; // invalidate so the next read reflects the change
    return this.getStoreConfig();
  },

  invalidate() {
    cache = null;
  },
};

function upsert(key: string, value: string) {
  return prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
