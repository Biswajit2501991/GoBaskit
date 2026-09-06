import { prisma } from '@/lib/prisma';
import { InventoryService } from '@/services/InventoryService';
import { appendPackSize, composeOrderItemName } from '@/utils/orderItemName';
import { variantLabel, variantSizeLabel } from '@/utils/variant';

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
};

export class CheckoutQuoteService {
  static async quoteLines(items: CheckoutLineInput[]): Promise<QuotedCheckoutLine[]> {
    const stockItems = items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
    }));
    await InventoryService.validateCheckoutItems(stockItems);

    const productIds = [...new Set(items.map((item) => item.productId))];
    const variantIds = [
      ...new Set(
        items
          .map((item) => item.variantId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];

    const [products, variants] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, unit: true, price: true, hasVariants: true },
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

      const variant = item.variantId ? variantById.get(item.variantId) : undefined;
      if (item.variantId) {
        if (!variant || variant.productId !== item.productId) {
          throw new Error('A product option in your cart is no longer available.');
        }
      }

      const packSize = variant
        ? variantSizeLabel(variant) || item.unit
        : (product.unit ?? '').trim() || item.unit;
      const price = variant ? variant.price : product.price;

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
      };
    });
  }
}
