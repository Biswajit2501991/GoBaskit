import { prisma } from '@/lib/prisma';
import { computeOrderProfit, withDeliveryProfit, type ProfitOrderResult } from '@/lib/profitDashboard';
import { coerceFulfillmentSource } from '@/lib/fulfillmentSource';
import { SettingsService } from '@/services/SettingsService';
import { roundMoney } from '@/lib/shopSourcing';

export class ProfitDashboardService {
  static async isEnabled() {
    const config = await SettingsService.getStoreConfig();
    return config.profitDashboardEnabled === true;
  }

  static async setEnabled(enabled: boolean) {
    return SettingsService.updateStoreConfig({ profitDashboardEnabled: enabled });
  }

  static async overview(params: { from: Date; to: Date; includeDelivery: boolean }) {
    const enabled = await this.isEnabled();
    if (!enabled) {
      return {
        enabled: false,
        from: params.from.toISOString(),
        to: params.to.toISOString(),
        includeDelivery: params.includeDelivery,
        totals: emptyTotals(),
        rows: [] as Array<ReturnType<typeof summarizeRow>>,
      };
    }

    const orders = await prisma.order.findMany({
      where: {
        archivedAt: null,
        status: { not: 'CANCELLED' },
        createdAt: { gte: params.from, lte: params.to },
      },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        grandTotal: true,
        deliveryCharge: true,
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            totalPrice: true,
            fulfillmentSource: true,
            fulfillmentRoute: true,
            costPriceSnapshot: true,
            product: { select: { fulfillmentSource: true, costPrice: true } },
            variant: { select: { fulfillmentSource: true, costPrice: true } },
            shopFulfillmentItems: {
              select: {
                costToGobaskit: true,
                fulfillment: {
                  select: { suffix: true, costConfirmedAt: true, status: true },
                },
              },
            },
          },
        },
        shopFulfillments: {
          where: { status: { not: 'CANCELLED' } },
          select: {
            suffix: true,
            costToGobaskit: true,
            costConfirmedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const computed: ProfitOrderResult[] = orders.map((order) => {
      const tickets = order.shopFulfillments.map((row) => ({
        suffix: row.suffix,
        costToGobaskit: Number(row.costToGobaskit),
        costConfirmed: Boolean(row.costConfirmedAt),
      }));
      const lines = order.items.map((item) => {
        const fulfillment = item.shopFulfillmentItems.find((row) => row.fulfillment.status !== 'CANCELLED');
        const live = {
          variantSource: item.variant?.fulfillmentSource,
          variantCost: item.variant?.costPrice,
          productSource: item.product.fulfillmentSource,
          productCost: item.product.costPrice,
        };
        const liveSource =
          coerceFulfillmentSource(live.variantSource) !== 'UNSET'
            ? live.variantSource
            : live.productSource;
        const liveCost =
          item.variant?.costPrice != null ? item.variant.costPrice : item.product.costPrice;
        return {
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          totalPrice: Number(item.totalPrice),
          fulfillmentSource: item.fulfillmentSource,
          fulfillmentRoute: item.fulfillmentRoute,
          costPriceSnapshot: item.costPriceSnapshot,
          liveSource,
          liveCostPrice: liveCost,
          ticketSuffix: fulfillment?.fulfillment.suffix ?? null,
          shopLineCost: Number(fulfillment?.costToGobaskit ?? 0),
          shopCostConfirmed: Boolean(fulfillment?.fulfillment.costConfirmedAt),
        };
      });
      return computeOrderProfit({
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        grandTotal: Number(order.grandTotal),
        deliveryCharge: Number(order.deliveryCharge),
        lines,
        tickets,
      });
    });

    const rows = computed.map((row) => summarizeRow(row, params.includeDelivery));
    const totals = rows.reduce(
      (acc, row) => ({
        orders: acc.orders + 1,
        paidToShops: roundMoney(acc.paidToShops + row.paidToShops),
        paidToGobaskit: roundMoney(acc.paidToGobaskit + row.paidToGobaskit),
        outsourceProfit: roundMoney(acc.outsourceProfit + row.outsourceProfit),
        inHouseProfit: roundMoney(acc.inHouseProfit + row.inHouseProfit),
        totalProfit: roundMoney(acc.totalProfit + row.totalProfit),
        untaggedCount: acc.untaggedCount + row.untaggedCount,
        pendingShopCost: roundMoney(acc.pendingShopCost + row.pendingShopCost),
        deliveryCharge: roundMoney(acc.deliveryCharge + row.deliveryCharge),
      }),
      emptyTotals(),
    );

    return {
      enabled: true,
      from: params.from.toISOString(),
      to: params.to.toISOString(),
      includeDelivery: params.includeDelivery,
      totals,
      rows,
    };
  }

  static async orderDetail(orderId: string, includeDelivery: boolean) {
    const enabled = await this.isEnabled();
    if (!enabled) return { enabled: false as const, order: null };

    const full = await this.computeOne(orderId);
    if (!full) return { enabled: true as const, order: null };
    const extras = withDeliveryProfit(full, includeDelivery);
    return {
      enabled: true as const,
      order: {
        ...full,
        paidToGobaskit: extras.paidToGobaskit,
        totalProfit: extras.totalProfit,
        includeDelivery,
      },
    };
  }

  private static async computeOne(orderId: string): Promise<ProfitOrderResult | null> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, archivedAt: null, status: { not: 'CANCELLED' } },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        grandTotal: true,
        deliveryCharge: true,
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            totalPrice: true,
            fulfillmentSource: true,
            fulfillmentRoute: true,
            costPriceSnapshot: true,
            product: { select: { fulfillmentSource: true, costPrice: true } },
            variant: { select: { fulfillmentSource: true, costPrice: true } },
            shopFulfillmentItems: {
              select: {
                costToGobaskit: true,
                fulfillment: {
                  select: { suffix: true, costConfirmedAt: true, status: true },
                },
              },
            },
          },
        },
        shopFulfillments: {
          where: { status: { not: 'CANCELLED' } },
          select: { suffix: true, costToGobaskit: true, costConfirmedAt: true },
        },
      },
    });
    if (!order) return null;
    return computeOrderProfit({
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      grandTotal: Number(order.grandTotal),
      deliveryCharge: Number(order.deliveryCharge),
      tickets: order.shopFulfillments.map((row) => ({
        suffix: row.suffix,
        costToGobaskit: Number(row.costToGobaskit),
        costConfirmed: Boolean(row.costConfirmedAt),
      })),
      lines: order.items.map((item) => {
        const fulfillment = item.shopFulfillmentItems.find((row) => row.fulfillment.status !== 'CANCELLED');
        const liveSource =
          coerceFulfillmentSource(item.variant?.fulfillmentSource) !== 'UNSET'
            ? item.variant?.fulfillmentSource
            : item.product.fulfillmentSource;
        const liveCost = item.variant?.costPrice != null ? item.variant.costPrice : item.product.costPrice;
        return {
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          totalPrice: Number(item.totalPrice),
          fulfillmentSource: item.fulfillmentSource,
          fulfillmentRoute: item.fulfillmentRoute,
          costPriceSnapshot: item.costPriceSnapshot,
          liveSource,
          liveCostPrice: liveCost,
          ticketSuffix: fulfillment?.fulfillment.suffix ?? null,
          shopLineCost: Number(fulfillment?.costToGobaskit ?? 0),
          shopCostConfirmed: Boolean(fulfillment?.fulfillment.costConfirmedAt),
        };
      }),
    });
  }
}

function summarizeRow(row: ProfitOrderResult, includeDelivery: boolean) {
  const extras = withDeliveryProfit(row, includeDelivery);
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    createdAt: row.createdAt,
    paidToShops: row.paidToShops,
    paidToGobaskit: extras.paidToGobaskit,
    outsourceProfit: row.outsourceProfit,
    inHouseProfit: row.inHouseProfit,
    totalProfit: extras.totalProfit,
    untaggedCount: row.untaggedCount,
    pendingShopCost: row.pendingShopCost,
    missingInHouseCostCount: row.missingInHouseCostCount,
    deliveryCharge: row.deliveryCharge,
    tickets: row.tickets.map((ticket) => ticket.ticket),
  };
}

function emptyTotals() {
  return {
    orders: 0,
    paidToShops: 0,
    paidToGobaskit: 0,
    outsourceProfit: 0,
    inHouseProfit: 0,
    totalProfit: 0,
    untaggedCount: 0,
    pendingShopCost: 0,
    deliveryCharge: 0,
  };
}
