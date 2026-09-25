import { prisma } from '@/lib/prisma';
import { WISHLIST_MAX_ITEMS } from '@/constants';
import { normalizeMobile } from '@/utils/mobile';
import { variantLabel } from '@/utils/variant';

export { WISHLIST_MAX_ITEMS };
const RESTOCK_NOTICE_DAYS = 7;

export type WishlistAddInput = {
  productId: string;
  variantId?: string | null;
};

function variantKeyOf(variantId?: string | null): string {
  return variantId?.trim() || '';
}

function optionInStock(product: {
  stock: number;
  status: string;
  variants: Array<{ id: string; stock: number; isActive: boolean }>;
}, variantId?: string | null): boolean {
  if (product.status === 'INACTIVE') return false;
  if (variantId) {
    const variant = product.variants.find((v) => v.id === variantId);
    return Boolean(variant?.isActive && variant.stock > 0);
  }
  return product.stock > 0;
}

function optionLabel(
  product: {
    name: string;
    variants: Array<{
      id: string;
      brand: string;
      variantName: string;
      weight: string;
      unit: string;
    }>;
  },
  variantId?: string | null,
): string {
  if (!variantId) return product.name;
  const variant = product.variants.find((v) => v.id === variantId);
  if (!variant) return product.name;
  const label = variantLabel(variant);
  return label ? `${product.name} (${label})` : product.name;
}

export class WishlistService {
  static async list(mobile: string) {
    const normalized = normalizeMobile(mobile);
    const items = await prisma.customerWishlistItem.findMany({
      where: { mobile: normalized },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            variants: {
              where: { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    // Drop rows whose product was deleted / hidden / inactive.
    const visible = items.filter(
      (row) => row.product.isVisible && row.product.status !== 'INACTIVE',
    );

    // Keep awaitingRestock in sync with live stock.
    await Promise.all(
      visible.map(async (row) => {
        const inStock = optionInStock(row.product, row.variantId);
        if (!inStock && !row.awaitingRestock) {
          await prisma.customerWishlistItem.update({
            where: { id: row.id },
            data: { awaitingRestock: true },
          });
          row.awaitingRestock = true;
        }
      }),
    );

    return visible.map((row) => {
      const inStock = optionInStock(row.product, row.variantId);
      const variant = row.variantId
        ? row.product.variants.find((v) => v.id === row.variantId) ?? null
        : null;
      return {
        id: row.id,
        productId: row.productId,
        variantId: row.variantId,
        label: optionLabel(row.product, row.variantId),
        price: variant?.price ?? row.product.price,
        mrp: variant?.mrp ?? row.product.actualPrice,
        imageUrl: variant?.imageUrl || row.product.imageUrl,
        unit: variant ? `${variant.weight}${variant.unit}` : row.product.unit,
        inStock,
        awaitingRestock: row.awaitingRestock || !inStock,
        product: row.product,
      };
    });
  }

  static async add(mobile: string, input: WishlistAddInput) {
    const normalized = normalizeMobile(mobile);
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      include: { variants: { where: { isActive: true } } },
    });
    if (!product || !product.isVisible || product.status === 'INACTIVE') {
      throw new Error('Product is not available');
    }

    const variantId = input.variantId?.trim() || null;
    if (variantId) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (!variant) throw new Error('Option is not available');
    }

    const key = variantKeyOf(variantId);
    const existing = await prisma.customerWishlistItem.findUnique({
      where: {
        mobile_productId_variantKey: {
          mobile: normalized,
          productId: product.id,
          variantKey: key,
        },
      },
    });
    if (existing) return existing;

    const count = await prisma.customerWishlistItem.count({ where: { mobile: normalized } });
    if (count >= WISHLIST_MAX_ITEMS) {
      throw new Error(`Wishlist is full (max ${WISHLIST_MAX_ITEMS} items)`);
    }

    const inStock = optionInStock(product, variantId);
    return prisma.customerWishlistItem.create({
      data: {
        mobile: normalized,
        productId: product.id,
        variantId,
        variantKey: key,
        notifyOnRestock: true,
        awaitingRestock: !inStock,
      },
    });
  }

  static async remove(mobile: string, itemId: string) {
    const normalized = normalizeMobile(mobile);
    await prisma.customerWishlistItem.deleteMany({
      where: { id: itemId, mobile: normalized },
    });
  }

  static async removeByProduct(
    mobile: string,
    productId: string,
    variantId?: string | null,
  ) {
    const normalized = normalizeMobile(mobile);
    await prisma.customerWishlistItem.deleteMany({
      where: {
        mobile: normalized,
        productId,
        variantKey: variantKeyOf(variantId),
      },
    });
  }

  static async idsForMobile(mobile: string): Promise<string[]> {
    const normalized = normalizeMobile(mobile);
    const rows = await prisma.customerWishlistItem.findMany({
      where: { mobile: normalized },
      select: { productId: true, variantKey: true },
    });
    return rows.map((r) => `${r.productId}::${r.variantKey}`);
  }

  /**
   * On login / session restore: create restock notices for wishlisted items
   * that were awaiting stock and are now available again.
   */
  static async collectRestockNotices(mobile: string) {
    const normalized = normalizeMobile(mobile);
    const items = await prisma.customerWishlistItem.findMany({
      where: { mobile: normalized, notifyOnRestock: true, awaitingRestock: true },
      include: {
        product: {
          include: {
            variants: true,
          },
        },
      },
    });

    const created: Array<{
      id: string;
      productId: string;
      variantId: string | null;
      title: string;
      message: string;
    }> = [];

    const expiresAt = new Date(Date.now() + RESTOCK_NOTICE_DAYS * 24 * 60 * 60 * 1000);

    for (const row of items) {
      if (!row.product.isVisible || row.product.status === 'INACTIVE') continue;
      const inStock = optionInStock(row.product, row.variantId);
      if (!inStock) continue;

      const label = optionLabel(row.product, row.variantId);
      const title = `Back in stock · ${label}`;
      const message = `${label} is available again — order now before it sells out.`;

      const notice = await prisma.customerRestockNotice.create({
        data: {
          mobile: normalized,
          productId: row.productId,
          variantId: row.variantId,
          title,
          message,
          expiresAt,
        },
      });

      await prisma.customerWishlistItem.update({
        where: { id: row.id },
        data: { awaitingRestock: false, lastNotifiedAt: new Date() },
      });

      created.push({
        id: notice.id,
        productId: notice.productId,
        variantId: notice.variantId,
        title: notice.title,
        message: notice.message,
      });
    }

    // Also return any unread notices still within expiry (in case toast was missed).
    const unread = await prisma.customerRestockNotice.findMany({
      where: {
        mobile: normalized,
        readAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const byId = new Map<string, (typeof created)[number]>();
    for (const n of [...created, ...unread]) {
      byId.set(n.id, {
        id: n.id,
        productId: n.productId,
        variantId: n.variantId,
        title: n.title,
        message: n.message,
      });
    }
    return [...byId.values()];
  }

  static async markAwaitingRestock(productId: string, variantId?: string | null) {
    await prisma.customerWishlistItem.updateMany({
      where: {
        productId,
        variantKey: variantId?.trim() || '',
        notifyOnRestock: true,
      },
      data: { awaitingRestock: true },
    });
  }

  /**
   * Read-only demand board: how many customers saved each product option.
   * Does not create, update, or delete wishlist rows.
   */
  static async demandRanking(limit = 300) {
    const take = Math.min(Math.max(Number(limit) || 300, 1), 500);
    const rows = await prisma.customerWishlistItem.findMany({
      where: {
        product: { isVisible: true, status: { not: 'INACTIVE' } },
      },
      select: {
        productId: true,
        variantKey: true,
        variantId: true,
        awaitingRestock: true,
        product: {
          select: {
            name: true,
            price: true,
            stock: true,
            unit: true,
            imageUrl: true,
            variants: {
              select: {
                id: true,
                price: true,
                stock: true,
                isActive: true,
                brand: true,
                variantName: true,
                weight: true,
                unit: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    type Bucket = {
      productId: string;
      variantId: string | null;
      name: string;
      price: number;
      stock: number;
      unit: string;
      imageUrl: string | null;
      customers: number;
      waiting: number;
    };
    const map = new Map<string, Bucket>();
    for (const row of rows) {
      const key = `${row.productId}::${row.variantKey || ''}`;
      const variant = row.variantId
        ? row.product.variants.find((v) => v.id === row.variantId)
        : null;
      let bucket = map.get(key);
      if (!bucket) {
        const label = optionLabel(row.product, row.variantId);
        bucket = {
          productId: row.productId,
          variantId: row.variantId,
          name: label,
          price: variant ? variant.price : row.product.price,
          stock: variant ? variant.stock : row.product.stock,
          unit: variant?.unit || row.product.unit,
          imageUrl: variant?.imageUrl || row.product.imageUrl,
          customers: 0,
          waiting: 0,
        };
        map.set(key, bucket);
      }
      bucket.customers += 1;
      if (row.awaitingRestock) bucket.waiting += 1;
    }

    const items = [...map.values()].sort((a, b) => {
      if (b.customers !== a.customers) return b.customers - a.customers;
      if (b.waiting !== a.waiting) return b.waiting - a.waiting;
      return a.name.localeCompare(b.name);
    });

    return {
      totalProducts: items.length,
      totalSaves: rows.length,
      items: items.slice(0, take),
    };
  }

  static async markNoticesRead(mobile: string, ids?: string[]) {
    const normalized = normalizeMobile(mobile);
    await prisma.customerRestockNotice.updateMany({
      where: {
        mobile: normalized,
        readAt: null,
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });
  }
}
