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
    for (const item of items) {
      byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
    }

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
    for (const item of items) {
      byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
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

    await tx.order.update({
      where: { id: orderId },
      data: { stockReserved: true },
    });

    return { updated, previousStock };
  }

  static async restoreForOrder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { select: { productId: true, quantity: true } } },
    });
    if (!order?.stockReserved) return;

    const updated: ProductRow[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
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
