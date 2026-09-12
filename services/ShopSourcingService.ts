import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { SettingsService } from '@/services/SettingsService';
import { NotificationService } from '@/services/NotificationService';
import { runInteractiveTxn } from '@/lib/prismaInteractiveTxn';
import { adminEventBus } from '@/lib/realtime/eventBus';
import {
  fulfillmentTicket,
  generateDeliveryPin,
  hashDeliveryPin,
  isFourDigitPin,
  nextFulfillmentSuffix,
  parseShopSourcing,
  planShopCatalogSync,
  shopHistorySince,
  verifyDeliveryPinHash,
} from '@/lib/shopSourcing';
import { formatCustomerName } from '@/utils/customer';

export class ShopSourcingError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code?: string,
  ) {
    super(message);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export class ShopSourcingService {
  static async config() {
    const store = await SettingsService.getStoreConfig();
    return parseShopSourcing(store.shopSourcing);
  }

  static async isEnabled(): Promise<boolean> {
    return (await this.config()).enabled === true;
  }

  static async listShops() {
    return prisma.shop.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { staff: true, productShops: true } } },
    });
  }

  static async upsertShop(input: {
    id?: string;
    name: string;
    phone: string;
    address?: string;
    city?: string;
    active?: boolean;
  }) {
    const name = input.name.trim();
    const phone = input.phone.replace(/\D/g, '').slice(-10);
    if (name.length < 2) throw new ShopSourcingError('Enter a shop name');
    if (phone.length !== 10) throw new ShopSourcingError('Enter a 10-digit shop phone');
    const data = {
      name,
      phone,
      address: (input.address ?? '').trim(),
      city: (input.city ?? '').trim(),
      active: input.active !== false,
    };
    if (input.id) {
      return prisma.shop.update({ where: { id: input.id }, data });
    }
    return prisma.shop.create({ data });
  }

  static async setProductShops(productId: string, shopIds: string[]) {
    const cfg = await this.config();
    const unique = [...new Set(shopIds.filter(Boolean))];
    if (unique.length > cfg.maxShopsPerItem) {
      throw new ShopSourcingError(`This item can be tagged to at most ${cfg.maxShopsPerItem} shops`);
    }
    const shops = unique.length
      ? await prisma.shop.findMany({ where: { id: { in: unique }, active: true }, select: { id: true } })
      : [];
    if (shops.length !== unique.length) {
      throw new ShopSourcingError('One or more shops are missing or inactive');
    }
    await prisma.$transaction([
      prisma.productShop.deleteMany({
        where: { productId, shopId: { notIn: unique } },
      }),
      ...unique.map((shopId) =>
        prisma.productShop.upsert({
          where: { productId_shopId: { productId, shopId } },
          create: { productId, shopId },
          update: {},
        }),
      ),
    ]);
    return unique;
  }

  static async listCatalogForShop(shopId: string) {
    const shop = await prisma.shop.findFirst({ where: { id: shopId }, select: { id: true, name: true } });
    if (!shop) throw new ShopSourcingError('Shop not found', 404);
    const cfg = await this.config();
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
        productShops: { select: { shopId: true } },
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });
    return {
      shop,
      maxShopsPerItem: cfg.maxShopsPerItem,
      items: products.map((row) => {
        const assigned = row.productShops.some((tag) => tag.shopId === shopId);
        const otherCount = row.productShops.filter((tag) => tag.shopId !== shopId).length;
        return {
          id: row.id,
          name: row.name,
          categoryId: row.categoryId,
          categoryName: row.category.name,
          assigned,
          atCap: !assigned && otherCount >= cfg.maxShopsPerItem,
        };
      }),
    };
  }

  static async setShopCatalog(shopId: string, productIds: string[]) {
    const shop = await prisma.shop.findFirst({ where: { id: shopId, active: true }, select: { id: true } });
    if (!shop) throw new ShopSourcingError('Shop not found or inactive', 404);
    const cfg = await this.config();
    const wanted = [...new Set(productIds.filter(Boolean))];
    const products = wanted.length
      ? await prisma.product.findMany({
          where: { id: { in: wanted } },
          select: { id: true, productShops: { select: { shopId: true } } },
        })
      : [];
    if (products.length !== wanted.length) {
      throw new ShopSourcingError('One or more products are missing');
    }
    const currentRows = await prisma.productShop.findMany({
      where: { shopId },
      select: { productId: true },
    });
    const otherShopCountByProduct: Record<string, number> = {};
    for (const row of products) {
      otherShopCountByProduct[row.id] = row.productShops.filter((tag) => tag.shopId !== shopId).length;
    }
    const plan = planShopCatalogSync({
      currentProductIds: currentRows.map((row) => row.productId),
      wantedProductIds: wanted,
      otherShopCountByProduct,
      maxShopsPerItem: cfg.maxShopsPerItem,
    });

    const ops = [];
    if (plan.remove.length) {
      ops.push(
        prisma.productShop.deleteMany({
          where: { shopId, productId: { in: plan.remove } },
        }),
      );
    }
    for (const productId of plan.add) {
      ops.push(
        prisma.productShop.upsert({
          where: { productId_shopId: { productId, shopId } },
          create: { productId, shopId },
          update: {},
        }),
      );
    }
    if (ops.length) await prisma.$transaction(ops);

    return {
      added: plan.add.length,
      removed: plan.remove.length,
      skipped: plan.skipped,
      assigned: wanted.filter((id) => !plan.skipped.includes(id)).length,
    };
  }

  static async setShopCategory(shopId: string, categoryId: string, assigned: boolean) {
    const shop = await prisma.shop.findFirst({ where: { id: shopId, active: true }, select: { id: true } });
    if (!shop) throw new ShopSourcingError('Shop not found or inactive', 404);
    const category = await prisma.category.findFirst({ where: { id: categoryId }, select: { id: true } });
    if (!category) throw new ShopSourcingError('Category not found', 404);
    const inCategory = await prisma.product.findMany({
      where: { categoryId },
      select: { id: true },
    });
    const ids = inCategory.map((row) => row.id);
    if (!assigned) {
      const result = await prisma.productShop.deleteMany({
        where: { shopId, productId: { in: ids } },
      });
      return { added: 0, removed: result.count, skipped: [] as string[] };
    }
    const currentRows = await prisma.productShop.findMany({
      where: { shopId },
      select: { productId: true },
    });
    const current = new Set(currentRows.map((row) => row.productId));
    const wanted = [...current, ...ids];
    return this.setShopCatalog(shopId, wanted);
  }

  static async createDeliveryPin(orderId: string): Promise<string> {
    const existing = await prisma.orderDeliveryPin.findUnique({ where: { orderId } });
    if (existing) return '';
    const pin = generateDeliveryPin();
    await prisma.orderDeliveryPin.create({
      data: { orderId, pinHash: await hashDeliveryPin(pin) },
    });
    return pin;
  }

  static async verifyDeliveryPin(orderId: string, pin: string): Promise<boolean> {
    if (!isFourDigitPin(pin)) return false;
    const row = await prisma.orderDeliveryPin.findUnique({ where: { orderId } });
    if (!row) return false;
    return verifyDeliveryPinHash(pin, row.pinHash);
  }

  static async startForOrder(orderId: string) {
    if (!(await this.isEnabled())) return null;
    return this.openOfferRound(orderId);
  }

  static async openOfferRound(orderId: string) {
    const cfg = await this.config();
    if (!cfg.enabled) return null;

    const remaining = await this.remainingTaggedItems(orderId);
    if (!remaining.length) return null;

    const last = await prisma.shopOffer.findFirst({
      where: { orderId },
      orderBy: { round: 'desc' },
      select: { round: true },
    });
    const round = (last?.round ?? 0) + 1;
    if (round > cfg.maxOfferRounds) return null;

    await prisma.shopOffer.updateMany({
      where: { orderId, status: 'OPEN' },
      data: { status: 'CLOSED' },
    });

    const pickupHint = await this.earliestPickup(orderId);
    const offer = await prisma.shopOffer.create({
      data: {
        orderId,
        round,
        status: 'OPEN',
        expiresAt: new Date(Date.now() + cfg.offerTimeoutSeconds * 1000),
        pickupHint,
      },
    });

    await this.notifyShopsForOffer(offer.id);
    return offer;
  }

  static async remainingTaggedItems(orderId: string) {
    const items = await prisma.orderItem.findMany({
      where: { orderId, shopClaim: { is: null } },
      select: {
        id: true,
        productId: true,
        productName: true,
        quantity: true,
        unit: true,
        product: { select: { productShops: { where: { shop: { active: true } }, select: { shopId: true } } } },
      },
    });
    return items.filter((item) => item.product.productShops.length > 0);
  }

  static async earliestPickup(orderId: string): Promise<Date | null> {
    const row = await prisma.shopFulfillment.findFirst({
      where: { orderId, status: { not: 'CANCELLED' } },
      orderBy: { pickupAt: 'asc' },
      select: { pickupAt: true },
    });
    return row?.pickupAt ?? null;
  }

  static async listOpenForShop(shopId: string) {
    const offers = await prisma.shopOffer.findMany({
      where: {
        status: 'OPEN',
        expiresAt: { gt: new Date() },
        skips: { none: { shopId } },
      },
      include: {
        order: {
          include: {
            customer: true,
            items: {
              include: {
                shopClaim: true,
                product: {
                  select: {
                    productShops: { where: { shopId }, select: { shopId: true } },
                  },
                },
              },
            },
            shopFulfillments: {
              where: { status: { not: 'CANCELLED' } },
              select: { pickupAt: true },
              orderBy: { pickupAt: 'asc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return offers
      .map((offer) => {
        const items = offer.order.items.filter(
          (item) => !item.shopClaim && item.product.productShops.length > 0,
        );
        if (!items.length) return null;
        const customer = offer.order.customer;
        return {
          offerId: offer.id,
          round: offer.round,
          expiresAt: offer.expiresAt.toISOString(),
          pickupHint: (offer.pickupHint ?? offer.order.shopFulfillments[0]?.pickupAt)?.toISOString() ?? null,
          orderId: offer.order.id,
          orderNumber: offer.order.orderNumber,
          customer: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            mobile: customer.mobile,
            houseNumber: customer.houseNumber,
            street: customer.street,
            area: customer.area,
            landmark: customer.landmark,
            city: customer.city,
            pincode: customer.pincode,
          },
          items: items.map((item) => ({
            id: item.id,
            name: item.productName,
            quantity: item.quantity,
            unit: item.unit,
          })),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  static async listFulfillmentsForShop(shopId: string) {
    const rows = await prisma.shopFulfillment.findMany({
      where: {
        shopId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: shopHistorySince() },
      },
      select: {
        id: true,
        suffix: true,
        costToGobaskit: true,
        createdAt: true,
        pickupAt: true,
        order: { select: { orderNumber: true } },
        items: {
          select: {
            quantity: true,
            orderItem: { select: { productName: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      ticket: fulfillmentTicket(row.order.orderNumber, row.suffix),
      orderNumber: row.order.orderNumber,
      costToGobaskit: Number(row.costToGobaskit),
      acceptedAt: row.createdAt.toISOString(),
      pickupAt: row.pickupAt.toISOString(),
      items: row.items.map((item) => ({
        name: item.orderItem.productName,
        quantity: item.quantity,
        unit: item.orderItem.unit,
      })),
    }));
  }

  static staffCart(orderId: string) {
    return prisma.shopFulfillment.findMany({
      where: { orderId },
      include: {
        shop: { select: { id: true, name: true, phone: true } },
        items: { include: { orderItem: { select: { id: true, productName: true, quantity: true, unit: true } } } },
      },
      orderBy: { suffix: 'asc' },
    });
  }

  static async rejectOffer(shopId: string, offerId: string) {
    const offer = await prisma.shopOffer.findFirst({
      where: { id: offerId, status: 'OPEN' },
    });
    if (!offer) throw new ShopSourcingError('This pickup is no longer available', 409, 'GONE');
    await prisma.shopOfferSkip.upsert({
      where: { offerId_shopId: { offerId, shopId } },
      create: { offerId, shopId },
      update: {},
    });
    return { ok: true };
  }

  static async acceptOffer(params: {
    shopId: string;
    staffId: string;
    offerId: string;
    itemIds: string[];
    pickupAt: Date;
    costToGobaskit: number;
  }) {
    const itemIds = [...new Set(params.itemIds.filter(Boolean))];
    if (!itemIds.length) throw new ShopSourcingError('Tick at least one item');
    if (!(params.pickupAt instanceof Date) || Number.isNaN(params.pickupAt.getTime())) {
      throw new ShopSourcingError('Set a pickup time');
    }
    if (params.pickupAt.getTime() < Date.now() - 60_000) {
      throw new ShopSourcingError('Pickup time must be in the future');
    }
    const cost = Number(params.costToGobaskit);
    if (!Number.isFinite(cost) || cost < 0) {
      throw new ShopSourcingError('Enter the amount GoBaskit should pay this shop');
    }

    try {
      const result = await runInteractiveTxn(async (tx) => {
        const offer = await tx.shopOffer.findFirst({
          where: { id: params.offerId, status: 'OPEN', expiresAt: { gt: new Date() } },
        });
        if (!offer) {
          throw new ShopSourcingError('This pickup is no longer available', 409, 'GONE');
        }

        const skip = await tx.shopOfferSkip.findUnique({
          where: { offerId_shopId: { offerId: params.offerId, shopId: params.shopId } },
        });
        if (skip) throw new ShopSourcingError('You already declined this pickup', 409, 'GONE');

        const items = await tx.orderItem.findMany({
          where: { id: { in: itemIds }, orderId: offer.orderId },
          include: {
            shopClaim: true,
            product: {
              select: { productShops: { where: { shopId: params.shopId }, select: { shopId: true } } },
            },
          },
        });
        if (items.length !== itemIds.length) {
          throw new ShopSourcingError('Those items are not on this order');
        }
        if (items.some((item) => item.shopClaim || item.product.productShops.length === 0)) {
          throw new ShopSourcingError('Another shop accepted those items', 409, 'GONE');
        }

        const existingCount = await tx.shopFulfillment.count({ where: { orderId: offer.orderId } });
        const suffix = nextFulfillmentSuffix(existingCount);
        const order = await tx.order.findUniqueOrThrow({
          where: { id: offer.orderId },
          select: { orderNumber: true },
        });

        const fulfillment = await tx.shopFulfillment.create({
          data: {
            orderId: offer.orderId,
            shopId: params.shopId,
            suffix,
            pickupAt: params.pickupAt,
            costToGobaskit: cost,
            acceptedById: params.staffId,
            items: {
              create: items.map((item) => ({
                orderItemId: item.id,
                quantity: item.quantity,
              })),
            },
          },
        });

        for (const item of items) {
          await tx.shopItemClaim.create({
            data: {
              orderItemId: item.id,
              shopId: params.shopId,
              fulfillmentId: fulfillment.id,
            },
          });
        }

        await tx.shopOffer.update({
          where: { id: offer.id },
          data: { status: 'CLOSED' },
        });

        return {
          fulfillment,
          ticket: fulfillmentTicket(order.orderNumber, suffix),
          orderId: offer.orderId,
          claimedNames: items.map((item) => item.productName),
        };
      });

      void this.openOfferRound(result.orderId).catch((err) =>
        console.error('[shop-sourcing] next offer failed', err),
      );
      adminEventBus.emit({
        type: 'order_updated',
        payload: { id: result.orderId, shopFulfillmentId: result.fulfillment.id },
      });
      return result;
    } catch (err) {
      if (err instanceof ShopSourcingError) throw err;
      if (isUniqueViolation(err)) {
        throw new ShopSourcingError('Another shop accepted those items', 409, 'GONE');
      }
      throw err;
    }
  }

  static async expireAndRebroadcast() {
    if (!(await this.isEnabled())) return { expired: 0, reopened: 0 };
    const now = new Date();
    const expired = await prisma.shopOffer.findMany({
      where: { status: 'OPEN', expiresAt: { lte: now } },
      select: { id: true, orderId: true },
    });
    if (!expired.length) return { expired: 0, reopened: 0 };
    await prisma.shopOffer.updateMany({
      where: { id: { in: expired.map((row) => row.id) } },
      data: { status: 'EXPIRED' },
    });
    let reopened = 0;
    const seen = new Set<string>();
    for (const row of expired) {
      if (seen.has(row.orderId)) continue;
      seen.add(row.orderId);
      const next = await this.openOfferRound(row.orderId);
      if (next) reopened += 1;
    }
    return { expired: expired.length, reopened };
  }

  static async notifyShopsForOffer(offerId: string) {
    const offer = await prisma.shopOffer.findUnique({
      where: { id: offerId },
      include: {
        order: {
          include: {
            customer: true,
            items: {
              include: {
                shopClaim: true,
                product: { select: { productShops: { select: { shopId: true } } } },
              },
            },
            shopFulfillments: {
              where: { status: { not: 'CANCELLED' } },
              select: { pickupAt: true },
              orderBy: { pickupAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    });
    if (!offer) return;

    const remaining = offer.order.items.filter(
      (item) => !item.shopClaim && item.product.productShops.length > 0,
    );
    const shopIds = new Set<string>();
    for (const item of remaining) {
      for (const tag of item.product.productShops) shopIds.add(tag.shopId);
    }
    if (!shopIds.size) return;

    const skipped = await prisma.shopOfferSkip.findMany({
      where: { offerId: offer.id },
      select: { shopId: true },
    });
    skipped.forEach((row) => shopIds.delete(row.shopId));

    const staff = await prisma.staffAccount.findMany({
      where: { active: true, deletedAt: null, shopId: { in: [...shopIds] } },
      select: { id: true, shopId: true },
    });

    const customer = offer.order.customer;
    const pickupHint = offer.pickupHint ?? offer.order.shopFulfillments[0]?.pickupAt;
    const pickupLabel = pickupHint
      ? pickupHint.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      : null;

    for (const member of staff) {
      if (!member.shopId) continue;
      const shopItems = remaining.filter((item) =>
        item.product.productShops.some((tag) => tag.shopId === member.shopId),
      );
      if (!shopItems.length) continue;
      const itemSummary = shopItems
        .map((item) => `${item.quantity} ${item.unit} ${item.productName}`.trim())
        .join(', ');
      await NotificationService.notifyShopPickup({
        staffId: member.id,
        orderId: offer.order.id,
        orderNumber: offer.order.orderNumber,
        title: `New pickup · ${offer.order.orderNumber}`,
        message: [
          offer.order.orderNumber,
          formatCustomerName(customer.firstName, customer.lastName),
          `+91 ${customer.mobile} · ${customer.city}`,
          [customer.houseNumber, customer.street, customer.area].filter(Boolean).join(', '),
          `Items: ${itemSummary}`,
          pickupLabel ? `Pick up by ${pickupLabel}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        itemSummary,
      });
    }
  }

  static serializeFulfillments(
    rows: Awaited<ReturnType<typeof ShopSourcingService.staffCart>>,
    orderNumber: string,
  ) {
    const procurementTotal = rows.reduce((sum, row) => sum + (row.status === 'CANCELLED' ? 0 : row.costToGobaskit), 0);
    return {
      procurementTotal,
      fulfillments: rows.map((row) => ({
        id: row.id,
        ticket: fulfillmentTicket(orderNumber, row.suffix),
        suffix: row.suffix,
        status: row.status,
        pickupAt: row.pickupAt.toISOString(),
        costToGobaskit: row.costToGobaskit,
        shop: row.shop,
        items: row.items.map((line) => ({
          id: line.orderItem.id,
          name: line.orderItem.productName,
          quantity: line.quantity,
          unit: line.orderItem.unit,
        })),
      })),
    };
  }
}
