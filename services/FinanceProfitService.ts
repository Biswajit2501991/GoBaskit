import { prisma } from '@/lib/prisma';
import { fulfillmentTicket, roundMoney } from '@/lib/shopSourcing';

export type FinanceProfitRow = {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerPaid: number;
  deliveryCharge: number;
  groceryPaid: number;
  paidToShops: number;
  groceryProfit: number;
  costsPending: number;
  unsourcedItemCount: number;
  tickets: string[];
};

export class FinanceProfitService {
  static async overview(params?: { from?: Date; to?: Date }) {
    const to = params?.to ?? new Date();
    const from = params?.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        archivedAt: null,
        status: { not: 'CANCELLED' },
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        orderNumber: true,
        grandTotal: true,
        deliveryCharge: true,
        createdAt: true,
        items: {
          select: { id: true, shopClaim: { select: { id: true } } },
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

    const rows: FinanceProfitRow[] = orders.map((order) => {
      const customerPaid = roundMoney(Number(order.grandTotal));
      const deliveryCharge = roundMoney(Number(order.deliveryCharge));
      const groceryPaid = roundMoney(customerPaid - deliveryCharge);
      let paidToShops = 0;
      let costsPending = 0;
      const tickets: string[] = [];
      for (const row of order.shopFulfillments) {
        tickets.push(fulfillmentTicket(order.orderNumber, row.suffix));
        const cost = Number(row.costToGobaskit);
        if (row.costConfirmedAt) paidToShops += cost;
        else costsPending += cost;
      }
      paidToShops = roundMoney(paidToShops);
      costsPending = roundMoney(costsPending);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt.toISOString(),
        customerPaid,
        deliveryCharge,
        groceryPaid,
        paidToShops,
        groceryProfit: roundMoney(groceryPaid - paidToShops),
        costsPending,
        unsourcedItemCount: order.items.filter((item) => !item.shopClaim).length,
        tickets,
      };
    });

    const totals = rows.reduce(
      (acc, row) => ({
        customerPaid: roundMoney(acc.customerPaid + row.customerPaid),
        deliveryCharge: roundMoney(acc.deliveryCharge + row.deliveryCharge),
        groceryPaid: roundMoney(acc.groceryPaid + row.groceryPaid),
        paidToShops: roundMoney(acc.paidToShops + row.paidToShops),
        groceryProfit: roundMoney(acc.groceryProfit + row.groceryProfit),
        costsPending: roundMoney(acc.costsPending + row.costsPending),
        orders: acc.orders + 1,
      }),
      {
        customerPaid: 0,
        deliveryCharge: 0,
        groceryPaid: 0,
        paidToShops: 0,
        groceryProfit: 0,
        costsPending: 0,
        orders: 0,
      },
    );

    return { from: from.toISOString(), to: to.toISOString(), totals, rows };
  }
}
