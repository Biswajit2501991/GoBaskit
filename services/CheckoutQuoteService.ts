import { prisma } from '@/lib/prisma';
import { InventoryService } from '@/services/InventoryService';
import { SettingsService } from '@/services/SettingsService';
import { appendPackSize, composeOrderItemName } from '@/utils/orderItemName';
import { variantLabel, variantSizeLabel } from '@/utils/variant';
import {
  decideFulfillmentRoute,
  shouldReserveWarehouseStock,
  snapshotFulfillment,
  type FulfillmentRoute,
  type FulfillmentSource,
} from '@/lib/fulfillmentSource';
import { parseShopSourcing } from '@/lib/shopSourcing';

export type CheckoutLineInput = {
  productId: string;
  variantId?: string | null;
  name: string;
  quantity: number;
  price: number;
  unit: string;
};

export type QuotedCheckoutLine = {
  productId: string;
  variantId: string | null;
  name: string;
  quantity: number;
  price: number;
  unit: string;
  fulfillmentSource: FulfillmentSource;
  fulfillmentRoute: FulfillmentRoute | null;
  costPriceSnapshot: number | null;
};

export class CheckoutQuoteService {
  static async quoteLines(items: CheckoutLineInput[]): Promise<QuotedCheckoutLine[]> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const variantIds = [
      ...new Set(
        items
          .map((item) => item.variantId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];

    await InventoryService.refillOutsourceBuffers({ productIds, variantIds });
    const shopSourcingEnabled = parseShopSourcing(
      (await SettingsService.getStoreConfig()).shopSourcing,
    ).enabled;

    const [products, variants] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          unit: true,
          price: true,
          hasVariants: true,
          stock: true,
          status: true,
          fulfillmentSource: true,
          costPrice: true,
        },
      }),
      variantIds.length
        ? prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              productId: true,
              price: true,
              brand: true,
              variantName: true,
              weight: true,
              unit: true,
              stock: true,
              isActive: true,
              fulfillmentSource: true,
              costPrice: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));
    const variantById = new Map(variants.map((v) => [v.id, v]));

    return items.map((item) => {
      const product = productById.get(item.productId);
      if (!product) {
        throw new Error('A product in your cart is no longer available.');
      }
      if (product.status === 'INACTIVE') {
        throw new Error(`${product.name} is currently unavailable.`);
      }

      const variant = item.variantId ? variantById.get(item.variantId) : undefined;
      if (item.variantId) {
        if (!variant || variant.productId !== item.productId) {
          throw new Error('A product option in your cart is no longer available.');
        }
        if (!variant.isActive) {
          throw new Error(`${product.name} option is currently unavailable.`);
        }
      }

      const packSize = variant
        ? variantSizeLabel(variant) || item.unit
        : (product.unit ?? '').trim() || item.unit;
      const price = variant ? variant.price : product.price;
      const stock = variant ? variant.stock : product.stock;

      const snap = snapshotFulfillment({
        productSource: product.fulfillmentSource,
        productCost: product.costPrice,
        variantSource: variant?.fulfillmentSource,
        variantCost: variant?.costPrice,
      });
      const fulfillmentRoute = decideFulfillmentRoute({
        source: snap.fulfillmentSource,
        availableStock: stock,
        quantity: item.quantity,
        shopSourcingEnabled,
      });

      if (
        shouldReserveWarehouseStock({
          fulfillmentSource: snap.fulfillmentSource,
          fulfillmentRoute,
        }) &&
        stock < item.quantity
      ) {
        const label = variant
          ? [variant.brand, variant.variantName, `${variant.weight}${variant.unit}`]
              .filter(Boolean)
              .join(' ')
              .trim() || product.name
          : product.name;
        throw new Error(
          stock > 0
            ? `Only ${stock} unit${stock === 1 ? '' : 's'} of ${label} left in stock.`
            : `${label} is out of stock.`,
        );
      }

      return {
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        price,
        unit: (packSize || item.unit || 'pcs').trim() || 'pcs',
        name: appendPackSize(
          composeOrderItemName({
            productName: product.name,
            variantLabel: variant ? variantLabel(variant) : null,
            clientName: item.name,
          }),
          packSize,
        ),
        fulfillmentSource: snap.fulfillmentSource,
        fulfillmentRoute,
        costPriceSnapshot: snap.costPriceSnapshot,
      };
    });
  }
}
