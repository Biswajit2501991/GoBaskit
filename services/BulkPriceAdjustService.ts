import { prisma } from '@/lib/prisma';
import { buildProductPricingData } from '@/utils/pricing';

const UNDO_SETTING_KEY = 'bulk_price_adjust_last';
const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;
const PREVIEW_SAMPLE = 25;
/** Small batches — avoids Prisma interactive-tx 5s timeout on large catalogs. */
const UPDATE_CHUNK = 25;

async function applyProductPriceChunks(
  rows: Array<{ id: string; price: number; actualPrice: number | null; discount: number }>,
) {
  for (let i = 0; i < rows.length; i += UPDATE_CHUNK) {
    const chunk = rows.slice(i, i + UPDATE_CHUNK);
    await Promise.all(
      chunk.map((row) =>
        prisma.product.updateMany({
          where: { id: row.id },
          data: {
            price: row.price,
            actualPrice: row.actualPrice,
            discount: row.discount,
          },
        }),
      ),
    );
  }
}

async function applyVariantPriceChunks(
  rows: Array<{ id: string; price: number; mrp: number | null; discount: number }>,
) {
  for (let i = 0; i < rows.length; i += UPDATE_CHUNK) {
    const chunk = rows.slice(i, i + UPDATE_CHUNK);
    await Promise.all(
      chunk.map((row) =>
        prisma.productVariant.updateMany({
          where: { id: row.id },
          data: {
            price: row.price,
            mrp: row.mrp,
            discount: row.discount,
          },
        }),
      ),
    );
  }
}

export type BulkPricePreviewRow = {
  kind: 'product' | 'variant';
  id: string;
  name: string;
  categoryName: string;
  beforePrice: number;
  afterPrice: number;
  beforeMrp: number | null;
  afterMrp: number | null;
};

export type BulkPricePreviewResult = {
  percent: number;
  categoryId: string | null;
  categoryName: string | null;
  productCount: number;
  variantCount: number;
  skipped: number;
  sample: BulkPricePreviewRow[];
};

type ProductSnapshot = {
  id: string;
  price: number;
  actualPrice: number | null;
  discount: number;
};

type VariantSnapshot = {
  id: string;
  price: number;
  mrp: number | null;
  discount: number;
};

export type BulkPriceUndoRecord = {
  id: string;
  createdAt: string;
  expiresAt: string;
  percent: number;
  categoryId: string | null;
  categoryName: string | null;
  products: ProductSnapshot[];
  variants: VariantSnapshot[];
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function scalePrice(value: number, percent: number): number {
  return roundMoney(value * (1 + percent / 100));
}

/** Clamp to a practical range; 0 is rejected by callers. */
export function normalizePercent(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n === 0) return null;
  if (n < -90 || n > 500) return null;
  return roundMoney(n);
}

function adjustPair(
  price: number,
  mrp: number | null | undefined,
  percent: number,
): { ok: true; price: number; actualPrice: number | null; discount: number } | { ok: false } {
  const nextPrice = scalePrice(price, percent);
  if (!(nextPrice > 0)) return { ok: false };

  const nextMrp =
    mrp != null && Number.isFinite(mrp) && mrp > 0 ? scalePrice(mrp, percent) : null;

  const pricing = buildProductPricingData({
    price: nextPrice,
    actualPrice: nextMrp,
  });

  if (!(pricing.price > 0)) return { ok: false };
  return {
    ok: true,
    price: pricing.price,
    actualPrice: pricing.actualPrice,
    discount: pricing.discount,
  };
}

async function resolveCategory(categoryId: string | null | undefined) {
  if (!categoryId) return { categoryId: null as string | null, categoryName: null as string | null };
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true },
  });
  if (!cat) throw new Error('Invalid category');
  return { categoryId: cat.id, categoryName: cat.name };
}

function productWhere(categoryId: string | null) {
  return categoryId ? { categoryId } : {};
}

export class BulkPriceAdjustService {
  static async preview(input: {
    percent: number;
    categoryId?: string | null;
  }): Promise<BulkPricePreviewResult> {
    const percent = normalizePercent(input.percent);
    if (percent == null) {
      throw new Error('Percent must be a non-zero number between -90 and 500');
    }

    const { categoryId, categoryName } = await resolveCategory(input.categoryId ?? null);
    const where = productWhere(categoryId);

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        actualPrice: true,
        category: { select: { name: true } },
        variants: {
          select: {
            id: true,
            brand: true,
            variantName: true,
            price: true,
            mrp: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const sample: BulkPricePreviewRow[] = [];
    let skipped = 0;
    let variantCount = 0;

    for (const p of products) {
      const next = adjustPair(p.price, p.actualPrice, percent);
      if (!next.ok) {
        skipped += 1;
      } else if (sample.length < PREVIEW_SAMPLE) {
        sample.push({
          kind: 'product',
          id: p.id,
          name: p.name,
          categoryName: p.category.name,
          beforePrice: p.price,
          afterPrice: next.price,
          beforeMrp: p.actualPrice,
          afterMrp: next.actualPrice,
        });
      }

      for (const v of p.variants) {
        variantCount += 1;
        const vNext = adjustPair(v.price, v.mrp, percent);
        if (!vNext.ok) {
          skipped += 1;
          continue;
        }
        if (sample.length < PREVIEW_SAMPLE) {
          const label = [v.brand, v.variantName].filter(Boolean).join(' · ') || 'Option';
          sample.push({
            kind: 'variant',
            id: v.id,
            name: `${p.name} — ${label}`,
            categoryName: p.category.name,
            beforePrice: v.price,
            afterPrice: vNext.price,
            beforeMrp: v.mrp,
            afterMrp: vNext.actualPrice,
          });
        }
      }
    }

    return {
      percent,
      categoryId,
      categoryName,
      productCount: products.length,
      variantCount,
      skipped,
      sample,
    };
  }

  static async apply(input: {
    percent: number;
    categoryId?: string | null;
  }): Promise<{
    percent: number;
    categoryId: string | null;
    categoryName: string | null;
    updatedProducts: number;
    updatedVariants: number;
    skipped: number;
    undo: BulkPriceUndoRecord;
  }> {
    const percent = normalizePercent(input.percent);
    if (percent == null) {
      throw new Error('Percent must be a non-zero number between -90 and 500');
    }

    const { categoryId, categoryName } = await resolveCategory(input.categoryId ?? null);
    const where = productWhere(categoryId);

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        price: true,
        actualPrice: true,
        discount: true,
        variants: {
          select: { id: true, price: true, mrp: true, discount: true },
        },
      },
    });

    const productUpdates: Array<{ id: string; price: number; actualPrice: number | null; discount: number }> =
      [];
    const variantUpdates: Array<{ id: string; price: number; mrp: number | null; discount: number }> = [];
    const productSnapshots: ProductSnapshot[] = [];
    const variantSnapshots: VariantSnapshot[] = [];
    let skipped = 0;

    for (const p of products) {
      const next = adjustPair(p.price, p.actualPrice, percent);
      if (!next.ok) {
        skipped += 1;
      } else {
        productSnapshots.push({
          id: p.id,
          price: p.price,
          actualPrice: p.actualPrice,
          discount: p.discount,
        });
        productUpdates.push({
          id: p.id,
          price: next.price,
          actualPrice: next.actualPrice,
          discount: next.discount,
        });
      }

      for (const v of p.variants) {
        const vNext = adjustPair(v.price, v.mrp, percent);
        if (!vNext.ok) {
          skipped += 1;
          continue;
        }
        variantSnapshots.push({
          id: v.id,
          price: v.price,
          mrp: v.mrp,
          discount: v.discount,
        });
        variantUpdates.push({
          id: v.id,
          price: vNext.price,
          mrp: vNext.actualPrice,
          discount: vNext.discount,
        });
      }
    }

    if (productUpdates.length === 0 && variantUpdates.length === 0) {
      throw new Error('No prices could be updated with this percent');
    }

    const now = Date.now();
    const undo: BulkPriceUndoRecord = {
      id: `bpa_${now.toString(36)}`,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + UNDO_WINDOW_MS).toISOString(),
      percent,
      categoryId,
      categoryName,
      products: productSnapshots,
      variants: variantSnapshots,
    };

    // Persist undo first so a mid-apply failure can still be restored.
    await prisma.setting.upsert({
      where: { key: UNDO_SETTING_KEY },
      create: { key: UNDO_SETTING_KEY, value: JSON.stringify(undo) },
      update: { value: JSON.stringify(undo) },
    });

    try {
      // Chunked updates (no single interactive transaction) — large catalogs
      // were exceeding Prisma's default 5s tx timeout.
      await applyProductPriceChunks(productUpdates);
      await applyVariantPriceChunks(variantUpdates);
    } catch (err) {
      try {
        await applyProductPriceChunks(productSnapshots);
        await applyVariantPriceChunks(variantSnapshots);
      } catch (rollbackErr) {
        console.error('[BulkPriceAdjust] rollback after apply failure', rollbackErr);
      }
      throw err;
    }

    return {
      percent,
      categoryId,
      categoryName,
      updatedProducts: productUpdates.length,
      updatedVariants: variantUpdates.length,
      skipped,
      undo,
    };
  }

  static async getUndoStatus(): Promise<{
    available: boolean;
    undo: BulkPriceUndoRecord | null;
  }> {
    const row = await prisma.setting.findUnique({ where: { key: UNDO_SETTING_KEY } });
    if (!row?.value) return { available: false, undo: null };
    try {
      const undo = JSON.parse(row.value) as BulkPriceUndoRecord;
      if (!undo?.id || !Array.isArray(undo.products) || !Array.isArray(undo.variants)) {
        return { available: false, undo: null };
      }
      const available = new Date(undo.expiresAt).getTime() > Date.now();
      return { available, undo: available ? undo : undo };
    } catch {
      return { available: false, undo: null };
    }
  }

  static async undo(): Promise<{ restoredProducts: number; restoredVariants: number }> {
    const status = await this.getUndoStatus();
    if (!status.undo) throw new Error('Nothing to undo');
    if (new Date(status.undo.expiresAt).getTime() <= Date.now()) {
      throw new Error('Undo window expired (24 hours)');
    }

    const { products, variants } = status.undo;

    await applyProductPriceChunks(products);
    await applyVariantPriceChunks(variants);

    await prisma.setting.delete({ where: { key: UNDO_SETTING_KEY } }).catch(() => undefined);

    return {
      restoredProducts: products.length,
      restoredVariants: variants.length,
    };
  }
}
