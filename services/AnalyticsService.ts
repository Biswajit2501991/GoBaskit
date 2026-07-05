import { prisma } from '@/lib/prisma';

export interface AnalyticsOverview {
  salesLast30Days: number;
  ordersLast30Days: number;
  averageBasketValue: number;
  customersLast30Days: number;
  averageDeliveryMinutes: number;
  statusBreakdown: Array<{ status: string; count: number }>;
  conversionRate: number;
  abandonmentRate: number;
  abandonedOrdersProxy: number;
  checkoutAttemptsProxy: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  lowProducts: Array<{ name: string; quantity: number; revenue: number }>;
  staffPerformance: Array<{
    staffId: string;
    staffName: string;
    assignedOrders: number;
    deliveredOrders: number;
    completionRate: number;
    averageHandleMinutes: number;
  }>;
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
      stalePendingCount,
      topProductsRaw,
      lowProductsRaw,
      recentOrders,
      staffRows,
      assignedTotalsRaw,
      deliveredTotalsRaw,
      assignedOrdersForDuration,
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
      prisma.order.count({
        where: {
          status: 'PENDING',
          createdAt: { lt: new Date(Date.now() - 45 * 60 * 1000) },
        },
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
      prisma.staffAccount.findMany({
        where: { active: true, deletedAt: null },
        select: { id: true, name: true },
      }),
      prisma.order.groupBy({
        by: ['assignedStaffId'],
        where: {
          createdAt: { gte: thirtyDaysAgo },
          assignedStaffId: { not: null },
        },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ['assignedStaffId'],
        where: {
          createdAt: { gte: thirtyDaysAgo },
          assignedStaffId: { not: null },
          status: 'DELIVERED',
        },
        _count: { _all: true },
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          assignedStaffId: { not: null },
        },
        select: {
          assignedStaffId: true,
          createdAt: true,
          updatedAt: true,
        },
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

    const delivered = statusBreakdownRaw.find((s) => s.status === 'DELIVERED')?._count._all ?? 0;
    const cancelled = statusBreakdownRaw.find((s) => s.status === 'CANCELLED')?._count._all ?? 0;
    const checkoutAttemptsProxy = orderAgg._count._all + stalePendingCount + cancelled;
    const conversionRate =
      checkoutAttemptsProxy > 0 ? Math.round((delivered / checkoutAttemptsProxy) * 10000) / 100 : 0;
    const abandonmentRate =
      checkoutAttemptsProxy > 0 ? Math.round((stalePendingCount / checkoutAttemptsProxy) * 10000) / 100 : 0;

    const staffNameMap = new Map(staffRows.map((s) => [s.id, s.name]));
    const assignedMap = new Map(
      assignedTotalsRaw
        .filter((r) => !!r.assignedStaffId)
        .map((r) => [r.assignedStaffId as string, r._count._all]),
    );
    const deliveredMap = new Map(
      deliveredTotalsRaw
        .filter((r) => !!r.assignedStaffId)
        .map((r) => [r.assignedStaffId as string, r._count._all]),
    );
    const durationMap = new Map<string, { total: number; count: number }>();
    for (const row of assignedOrdersForDuration) {
      if (!row.assignedStaffId) continue;
      const mins = Math.max(0, Math.round((row.updatedAt.getTime() - row.createdAt.getTime()) / 60000));
      const curr = durationMap.get(row.assignedStaffId) ?? { total: 0, count: 0 };
      curr.total += mins;
      curr.count += 1;
      durationMap.set(row.assignedStaffId, curr);
    }
    const staffPerformance = staffRows
      .map((s) => {
        const assignedOrders = assignedMap.get(s.id) ?? 0;
        const deliveredOrders = deliveredMap.get(s.id) ?? 0;
        const dur = durationMap.get(s.id);
        return {
          staffId: s.id,
          staffName: s.name,
          assignedOrders,
          deliveredOrders,
          completionRate:
            assignedOrders > 0 ? Math.round((deliveredOrders / assignedOrders) * 10000) / 100 : 0,
          averageHandleMinutes: dur && dur.count > 0 ? Math.round(dur.total / dur.count) : 0,
        };
      })
      .filter((s) => s.assignedOrders > 0 || s.deliveredOrders > 0)
      .sort((a, b) => b.deliveredOrders - a.deliveredOrders)
      .slice(0, 10);

    const value: AnalyticsOverview = {
      salesLast30Days: orderAgg._sum.grandTotal ?? 0,
      ordersLast30Days: orderAgg._count._all,
      averageBasketValue: orderAgg._avg.grandTotal ?? 0,
      customersLast30Days: customerCount,
      averageDeliveryMinutes: deliveryCount ? Math.round(deliveryMinutesTotal / deliveryCount) : 0,
      statusBreakdown: statusBreakdownRaw.map((s) => ({ status: s.status, count: s._count._all })),
      conversionRate,
      abandonmentRate,
      abandonedOrdersProxy: stalePendingCount,
      checkoutAttemptsProxy,
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
      staffPerformance,
      salesTrend,
      updatedAt: new Date().toISOString(),
    };

    cache = { value, expires: Date.now() + TTL_MS };
    return value;
  }
}
