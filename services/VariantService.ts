import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { buildProductPricingData } from '@/utils/pricing';

export interface VariantInput {
  brand?: string;
  variantName?: string;
  details?: string;
  weight?: string;
  unit?: string;
  price: number;
  mrp?: number | null;
  sku?: string | null;
  barcode?: string | null;
  stock?: number;
  imageUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  attributes?: Record<string, unknown> | null;
}

export class VariantService {
  /** All variants for a product, ordered for admin management. */
  static async listByProduct(productId: string) {
    return prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Active, in-stock-first variants for storefront display. */
  static async listActiveByProduct(productId: string) {
    return prisma.productVariant.findMany({
      where: { productId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  private static pricingFields(input: VariantInput) {
    const { price, actualPrice, discount } = buildProductPricingData({
      price: input.price,
      actualPrice: input.mrp ?? null,
    });
    return { price, mrp: actualPrice, discount };
  }

  static async create(productId: string, input: VariantInput) {
    const pricing = this.pricingFields(input);
    const stock = Math.max(0, Math.trunc(input.stock ?? 0));
    const maxSort = await prisma.productVariant.aggregate({
      where: { productId },
      _max: { sortOrder: true },
    });
    const sortOrder = input.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1;

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        brand: input.brand?.trim() ?? '',
        variantName: input.variantName?.trim() ?? '',
        details: input.details?.trim() ?? '',
        weight: input.weight?.trim() ?? '',
        unit: input.unit?.trim() ?? '',
        price: pricing.price,
        mrp: pricing.mrp,
        discount: pricing.discount,
        sku: input.sku?.trim() || null,
        barcode: input.barcode?.trim() || null,
        stock,
        stockBaseline: stock,
        imageUrl: input.imageUrl?.trim() || null,
        sortOrder,
        isActive: input.isActive ?? true,
        attributes: (input.attributes ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await this.syncProductHasVariants(productId);
    return variant;
  }

  static async update(productId: string, variantId: string, input: VariantInput) {
    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!existing) throw new Error('Variant not found');

    const pricing = this.pricingFields(input);
    const stock = Math.max(0, Math.trunc(input.stock ?? existing.stock));
    const stockBaseline = Math.max(existing.stockBaseline, stock);

    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        brand: input.brand?.trim() ?? existing.brand,
        variantName: input.variantName?.trim() ?? existing.variantName,
        details: input.details?.trim() ?? existing.details,
        weight: input.weight?.trim() ?? existing.weight,
        unit: input.unit?.trim() ?? existing.unit,
        price: pricing.price,
        mrp: pricing.mrp,
        discount: pricing.discount,
        sku: input.sku?.trim() || null,
        barcode: input.barcode?.trim() || null,
        stock,
        stockBaseline,
        imageUrl: input.imageUrl?.trim() || null,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        isActive: input.isActive ?? existing.isActive,
        attributes: (input.attributes ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return variant;
  }

  static async updateStock(productId: string, variantId: string, stock: number) {
    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!existing) throw new Error('Variant not found');
    const next = Math.max(0, Math.trunc(stock));
    return prisma.productVariant.update({
      where: { id: variantId },
      data: { stock: next, stockBaseline: Math.max(existing.stockBaseline, next) },
    });
  }

  static async remove(productId: string, variantId: string) {
    await prisma.productVariant.deleteMany({ where: { id: variantId, productId } });
    await this.syncProductHasVariants(productId);
  }

  static async reorder(productId: string, orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.productVariant.updateMany({
          where: { id, productId },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  /** Keep product.hasVariants in sync with whether any variant rows exist. */
  static async syncProductHasVariants(productId: string) {
    const count = await prisma.productVariant.count({ where: { productId } });
    await prisma.product.update({
      where: { id: productId },
      data: { hasVariants: count > 0 },
    });
    return count;
  }
}
