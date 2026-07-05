import { prisma } from '@/lib/prisma';

export interface AnalyticsOverview {
  salesLast30Days: number;
  ordersLast30Days: number;
  averageBasketValue: number;
  customersLast30Days: number;
  averageDeliveryMinutes: number;
  statusBreakdown: Array<{ status: string; count: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  lowProducts: Array<{ name: string; quantity: number; revenue: number }>;
  salesTrend: Array<{ day: string; revenue: number; orders: number }>;
  updatedAt: string;
}

const TTL_MS = 60 * 1000;
let cache: { value: AnalyticsOverview; expires: number } | null = null;

export class AnalyticsService {
  static invalidateCache() {
    cache = null;
  }

  static async getOverview(): Promise<AnalyticsOverview> {
    if (cache && cache.expires > Date.now()) {
      return cache.value;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [
      orderAgg,
      customerCount,
      statusBreakdownRaw,
      topProductsRaw,
      lowProductsRaw,
      recentOrders,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { grandTotal: true },
        _count: { _all: true },
        _avg: { grandTotal: true },
      }),
      prisma.customer.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.orderItem.groupBy({
        by: ['productName'],
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 10,
      }),
      prisma.orderItem.groupBy({
        by: ['productName'],
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { totalPrice: 'asc' } },
        take: 10,
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, updatedAt: true, grandTotal: true },
      }),
    ]);

    let deliveryMinutesTotal = 0;
    let deliveryCount = 0;
    const trendMap = new Map<string, { revenue: number; orders: number }>();
    for (const order of recentOrders) {
      const day = order.createdAt.toISOString().slice(0, 10);
      const curr = trendMap.get(day) ?? { revenue: 0, orders: 0 };
      curr.revenue += order.grandTotal;
      curr.orders += 1;
      trendMap.set(day, curr);

      deliveryMinutesTotal += Math.max(
        0,
        Math.round((order.updatedAt.getTime() - order.createdAt.getTime()) / 60000),
      );
      deliveryCount += 1;
    }

    const salesTrend = Array.from({ length: 30 }, (_, i) => {
      const dayDate = new Date(thirtyDaysAgo);
      dayDate.setDate(thirtyDaysAgo.getDate() + i);
      const day = dayDate.toISOString().slice(0, 10);
      const row = trendMap.get(day) ?? { revenue: 0, orders: 0 };
      return { day, revenue: row.revenue, orders: row.orders };
    });

    const value: AnalyticsOverview = {
      salesLast30Days: orderAgg._sum.grandTotal ?? 0,
      ordersLast30Days: orderAgg._count._all,
      averageBasketValue: orderAgg._avg.grandTotal ?? 0,
      customersLast30Days: customerCount,
      averageDeliveryMinutes: deliveryCount ? Math.round(deliveryMinutesTotal / deliveryCount) : 0,
      statusBreakdown: statusBreakdownRaw.map((s) => ({ status: s.status, count: s._count._all })),
      topProducts: topProductsRaw.map((p) => ({
        name: p.productName,
        quantity: p._sum.quantity ?? 0,
        revenue: p._sum.totalPrice ?? 0,
      })),
      lowProducts: lowProductsRaw.map((p) => ({
        name: p.productName,
        quantity: p._sum.quantity ?? 0,
        revenue: p._sum.totalPrice ?? 0,
      })),
      salesTrend,
      updatedAt: new Date().toISOString(),
    };

    cache = { value, expires: Date.now() + TTL_MS };
    return value;
  }
}
