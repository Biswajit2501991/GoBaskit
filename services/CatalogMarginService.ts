import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/AuditService';
import { NotificationService } from '@/services/NotificationService';
import { nextCatalogSellingPrice, roundMoney } from '@/lib/shopSourcing';
import { buildProductPricingData } from '@/utils/pricing';
import { formatOrderLineLabel } from '@/utils/orderItemName';

export class CatalogMarginService {
  /** Raise live catalog selling prices when shop unit cost ate the ₹3 floor. Never edits this order. */
  static async applyAfterFulfillmentCosts(fulfillmentId: string) {
    try {
      await this.run(fulfillmentId);
    } catch (err) {
      console.error('[catalog-margin] bump failed after costs saved', fulfillmentId, err);
    }
  }

  private static async run(fulfillmentId: string) {
    const fulfillment = await prisma.shopFulfillment.findFirst({
      where: { id: fulfillmentId, status: { not: 'CANCELLED' }, costConfirmedAt: { not: null } },
      select: {
        id: true,
        orderId: true,
        items: {
          select: {
            quantity: true,
            costToGobaskit: true,
            orderItem: {
              select: {
                productId: true,
                variantId: true,
                productName: true,
                quantity: true,
                unit: true,
              },
            },
          },
        },
      },
    });
    if (!fulfillment) return;

    for (const line of fulfillment.items) {
      const qty = line.quantity || line.orderItem.quantity || 1;
      if (qty <= 0) continue;
      const shopUnit = roundMoney(Number(line.costToGobaskit) / qty);
      const variantId = line.orderItem.variantId;
      const productId = line.orderItem.productId;
      const label = formatOrderLineLabel({
        productName: line.orderItem.productName,
        quantity: 1,
        unit: line.orderItem.unit,
      }).replace(/\s*×\s*1$/, '');

      if (variantId) {
        const variant = await prisma.productVariant.findUnique({
          where: { id: variantId },
          select: { id: true, price: true, mrp: true, productId: true },
        });
        if (!variant) continue;
        const next = nextCatalogSellingPrice(variant.price, shopUnit);
        if (next <= variant.price) continue;
        const pricing = buildProductPricingData({ price: next, actualPrice: variant.mrp });
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: { price: pricing.price, mrp: pricing.actualPrice, discount: pricing.discount },
        });
        await this.recordBump({
          orderId: fulfillment.orderId,
          entity: 'product_variants',
          entityId: variant.id,
          productId: variant.productId,
          label,
          from: variant.price,
          to: pricing.price,
          shopUnit,
        });
        continue;
      }

      if (!productId) continue;
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, price: true, actualPrice: true },
      });
      if (!product) continue;
      const next = nextCatalogSellingPrice(product.price, shopUnit);
      if (next <= product.price) continue;
      const pricing = buildProductPricingData({ price: next, actualPrice: product.actualPrice });
      await prisma.product.update({
        where: { id: product.id },
        data: { price: pricing.price, actualPrice: pricing.actualPrice, discount: pricing.discount },
      });
      await this.recordBump({
        orderId: fulfillment.orderId,
        entity: 'products',
        entityId: product.id,
        productId: product.id,
        label,
        from: product.price,
        to: pricing.price,
        shopUnit,
      });
    }
  }

  private static async recordBump(params: {
    orderId: string;
    entity: string;
    entityId: string;
    productId: string;
    label: string;
    from: number;
    to: number;
    shopUnit: number;
  }) {
    const delta = roundMoney(params.to - params.from);
    await AuditService.log({
      action: 'catalog_price_bumped',
      entity: params.entity,
      entityId: params.entityId,
      meta: {
        orderId: params.orderId,
        from: params.from,
        to: params.to,
        delta,
        shopUnit: params.shopUnit,
        label: params.label,
      },
    });
    await NotificationService.notifyCatalogPriceBump({
      productId: params.productId,
      title: `Item ${params.label} cost has been increased by ${delta} as market cost is increase`,
      message: `Item ${params.label} cost has been increased by ${delta} as market cost is increase`,
    });
  }
}
