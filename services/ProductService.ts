import { prisma } from '@/lib/prisma';
import type { ProductWithCategory } from '@/types';
import { ADMIN_LIST_PAGE_SIZE } from '@/constants';

export class ProductService {
  static async listAdmin(params?: {
    search?: string;
    categoryId?: string;
    page?: number;
    pageSize?: number;
    sort?: 'name' | 'stock';
  }) {
    const page = Math.max(params?.page ?? 1, 1);
    const pageSize = Math.min(params?.pageSize ?? ADMIN_LIST_PAGE_SIZE, 100);
    const where: Record<string, unknown> = {};

    if (params?.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        // Find parent products by option brand / name (e.g. search "Ganesh" → Almond).
        {
          variants: {
            some: {
              OR: [
                { brand: { contains: q, mode: 'insensitive' } },
                { variantName: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    if (params?.categoryId) {
      where.categoryId = params.categoryId;
    }

    const orderBy =
      params?.sort === 'stock'
        ? [{ stock: 'asc' as const }, { name: 'asc' as const }]
        : { name: 'asc' as const };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { variants: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  static async getAll(params?: {
    search?: string;
    categorySlug?: string;
    featured?: boolean;
    sort?: 'price_asc' | 'price_desc' | 'name';
  }): Promise<ProductWithCategory[]> {
    // Keep INACTIVE products hidden; show ACTIVE + OUT_OF_STOCK so customers
    // still see high-demand items marked as coming soon.
    const where: Record<string, unknown> = {
      isVisible: true,
      status: { in: ['ACTIVE', 'OUT_OF_STOCK'] },
    };

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search } },
        { description: { contains: params.search } },
      ];
    }

    if (params?.categorySlug) {
      where.category = { slug: params.categorySlug };
    }

    if (params?.featured) {
      where.isFeatured = true;
    }

    const orderBy =
      params?.sort === 'price_asc'
        ? { price: 'asc' as const }
        : params?.sort === 'price_desc'
        ? { price: 'desc' as const }
        : { name: 'asc' as const };

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy,
    });

    // Keep fully out-of-stock items visible but after in-stock ones.
    return products.sort((a, b) => {
      const aOk = a.stock > 0 || a.variants.some((v) => v.stock > 0) ? 0 : 1;
      const bOk = b.stock > 0 || b.variants.some((v) => v.stock > 0) ? 0 : 1;
      return aOk - bOk;
    });
  }

  static async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!product || !product.isVisible || product.status === 'INACTIVE') return null;
    return product;
  }

  static async getFeatured(limit = 8) {
    return this.getAll({ featured: true, sort: 'name' }).then((p) => p.slice(0, limit));
  }
}

export class CategoryService {
  static async listAdmin(params?: { search?: string; page?: number; pageSize?: number }) {
    const page = Math.max(params?.page ?? 1, 1);
    const pageSize = Math.min(params?.pageSize ?? ADMIN_LIST_PAGE_SIZE, 100);
    const where: Record<string, unknown> = {};

    if (params?.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { products: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.category.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  static async getAll(activeOnly = true) {
    return prisma.category.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  static async getBySlug(slug: string) {
    return prisma.category.findUnique({
      where: { slug },
      include: { _count: { select: { products: true } } },
    });
  }
}

export class SettingsService {
  static async get(key: string, fallback = '') {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting?.value ?? fallback;
  }

  static async getAll() {
    const settings = await prisma.setting.findMany();
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }

  static async set(key: string, value: string) {
    return prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
