import { prisma } from '@/lib/prisma';
import type { ProductWithCategory } from '@/types';

export class ProductService {
  static async getAll(params?: {
    search?: string;
    categorySlug?: string;
    featured?: boolean;
    sort?: 'price_asc' | 'price_desc' | 'name';
  }): Promise<ProductWithCategory[]> {
    const where: Record<string, unknown> = { isVisible: true, status: 'ACTIVE' };

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

    return prisma.product.findMany({
      where,
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy,
    });
  }

  static async getById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
  }

  static async getFeatured(limit = 8) {
    return this.getAll({ featured: true, sort: 'name' }).then((p) => p.slice(0, limit));
  }
}

export class CategoryService {
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
