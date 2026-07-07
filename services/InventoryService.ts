import type { ProductStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/NotificationService';
import { DashboardService } from '@/services/DashboardService';
import {
  isLowStock,
  lowStockThreshold,
  nextStockBaseline,
  resolveProductStatus,
} from '@/utils/inventory';

export { LOW_STOCK_RATIO } from '@/utils/inventory';

export interface OrderStockItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

type ProductRow = {
  id: string;
  name: string;
  stock: number;
  stockBaseline: number;
  status: ProductStatus;
  lowStockNotifiedAt: Date | null;
};

export class InventoryService {
  /** Threshold count at or below which a product is considered low stock (25% of baseline). */
  static lowStockThreshold = lowStockThreshold;

  static isLowStock = isLowStock;

  /** Keep INACTIVE manual override; otherwise sync from stock level. */
  static resolveStatus(stock: number, currentStatus: ProductStatus): ProductStatus {
    return resolveProductStatus(stock, currentStatus);
  }

  /** When staff sets stock, raise baseline to the new level if restocking. */
  static nextBaseline = nextStockBaseline;

  static async validateCheckoutItems(items: OrderStockItem[]): Promise<void> {
    if (!items.length) return;

    const byProduct = new Map<string, number>();
    const byVariant = new Map<string, number>();
    for (const item of items) {
      if (item.variantId) {
        byVariant.set(item.variantId, (byVariant.get(item.variantId) ?? 0) + item.quantity);
      } else {
        byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
      }
    }

    if (byProduct.size) {
      const products = await prisma.product.findMany({
        where: { id: { in: [...byProduct.keys()] } },
        select: { id: true, name: true, stock: true, status: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const [productId, qty] of byProduct) {
        const product = productMap.get(productId);
        if (!product) {
          throw new Error('A product in your cart is no longer available.');
        }
        if (product.status === 'INACTIVE') {
          throw new Error(`${product.name} is currently unavailable.`);
        }
        if (product.stock < qty) {
          const left = product.stock;
          throw new Error(
            left > 0
              ? `Only ${left} unit${left === 1 ? '' : 's'} of ${product.name} left in stock.`
              : `${product.name} is out of stock.`,
          );
        }
      }
    }

    if (byVariant.size) {
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: [...byVariant.keys()] } },
        select: { id: true, brand: true, variantName: true, weight: true, unit: true, stock: true, isActive: true },
      });
      const variantMap = new Map(variants.map((v) => [v.id, v]));

      for (const [variantId, qty] of byVariant) {
        const variant = variantMap.get(variantId);
        if (!variant) {
          throw new Error('A product option in your cart is no longer available.');
        }
        const label = [variant.brand, variant.variantName, `${variant.weight}${variant.unit}`]
          .filter(Boolean)
          .join(' ')
          .trim() || 'selected option';
        if (!variant.isActive) {
          throw new Error(`${label} is currently unavailable.`);
        }
        if (variant.stock < qty) {
          const left = variant.stock;
          throw new Error(
            left > 0
              ? `Only ${left} unit${left === 1 ? '' : 's'} of ${label} left in stock.`
              : `${label} is out of stock.`,
          );
        }
      }
    }
  }

  static async applyAdminStockUpdate(
    product: ProductRow,
    newStock: number,
    requestedStatus: ProductStatus,
  ): Promise<{ stock: number; stockBaseline: number; status: ProductStatus }> {
    const stockBaseline = this.nextBaseline(product.stockBaseline, newStock);
    const status = this.resolveStatus(newStock, requestedStatus);
    const clearedAlert = !this.isLowStock(newStock, stockBaseline);

    await prisma.product.update({
      where: { id: product.id },
      data: {
        stock: newStock,
        stockBaseline,
        status,
        ...(clearedAlert ? { lowStockNotifiedAt: null } : {}),
      },
    });

    await this.evaluateAlerts({
      ...product,
      stock: newStock,
      stockBaseline,
      status,
      lowStockNotifiedAt: clearedAlert ? null : product.lowStockNotifiedAt,
    });

    DashboardService.invalidateCache();
    return { stock: newStock, stockBaseline, status };
  }

  static async reserveForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    items: OrderStockItem[],
  ): Promise<{ updated: ProductRow[]; previousStock: Map<string, number> }> {
    const byProduct = new Map<string, number>();
    const byVariant = new Map<string, number>();
    for (const item of items) {
      if (item.variantId) {
        byVariant.set(item.variantId, (byVariant.get(item.variantId) ?? 0) + item.quantity);
      } else {
        byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
      }
    }

    const updated: ProductRow[] = [];
    const previousStock = new Map<string, number>();

    for (const [productId, qty] of byProduct) {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || product.stock < qty) {
        throw new Error(`Insufficient stock for ${product?.name ?? 'product'}`);
      }

      previousStock.set(productId, product.stock);
      const newStock = product.stock - qty;
      const status = this.resolveStatus(newStock, product.status);

      const row = await tx.product.update({
        where: { id: productId },
        data: { stock: newStock, status },
        select: {
          id: true,
          name: true,
          stock: true,
          stockBaseline: true,
          status: true,
          lowStockNotifiedAt: true,
        },
      });
      updated.push(row);
    }

    for (const [variantId, qty] of byVariant) {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (!variant || variant.stock < qty) {
        throw new Error(`Insufficient stock for ${variant?.brand ?? 'selected option'}`);
      }
      await tx.productVariant.update({
        where: { id: variantId },
        data: { stock: variant.stock - qty },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: { stockReserved: true },
    });

    return { updated, previousStock };
  }

  static async restoreForOrder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { select: { productId: true, variantId: true, quantity: true } } },
    });
    if (!order?.stockReserved) return;

    const updated: ProductRow[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
          if (variant) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: variant.stock + item.quantity },
            });
          }
          continue;
        }
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        const newStock = product.stock + item.quantity;
        const status = this.resolveStatus(newStock, product.status);
        const clearedAlert = !this.isLowStock(newStock, product.stockBaseline);

        const row = await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: newStock,
            status,
            ...(clearedAlert ? { lowStockNotifiedAt: null } : {}),
          },
          select: {
            id: true,
            name: true,
            stock: true,
            stockBaseline: true,
            status: true,
            lowStockNotifiedAt: true,
          },
        });
        updated.push(row);
      }

      await tx.order.update({
        where: { id: orderId },
        data: { stockReserved: false },
      });
    });

    for (const product of updated) {
      await this.evaluateAlerts(product);
    }
    DashboardService.invalidateCache();
  }

  static async afterOrderReserved(
    products: ProductRow[],
    previousStock: Map<string, number>,
  ): Promise<void> {
    for (const product of products) {
      await this.evaluateAlerts(product, previousStock.get(product.id));
    }
    DashboardService.invalidateCache();
  }

  static async evaluateAlerts(product: ProductRow, previousStock?: number): Promise<void> {
    if (product.stock <= 0) {
      if (previousStock !== undefined && previousStock <= 0) return;
      await NotificationService.notifyOutOfStock(product);
      return;
    }

    if (!this.isLowStock(product.stock, product.stockBaseline)) return;
    if (product.lowStockNotifiedAt) return;

    await NotificationService.notifyLowStock(product);
    await prisma.product.update({
      where: { id: product.id },
      data: { lowStockNotifiedAt: new Date() },
    });
  }
}
