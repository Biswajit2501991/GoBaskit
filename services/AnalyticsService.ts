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

const TTL_MS = 2 * 60 * 1000;
let cache: { value: AnalyticsOverview; expires: number } | null = null;

type DayAggRow = { day: Date; orders: bigint | number; revenue: number | null };
type ProductAggRow = { name: string; quantity: bigint | number; revenue: number | null };
type DeliveryAggRow = { avg_minutes: number | null };
type StaffDurationRow = {
  staff_id: string;
  assigned: bigint | number;
  delivered: bigint | number;
  avg_minutes: number | null;
};

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
    const stalePendingBefore = new Date(Date.now() - 45 * 60 * 1000);

    const [
      orderAgg,
      customerCount,
      statusBreakdownRaw,
      stalePendingCount,
      topProductsRaw,
      lowProductsRaw,
      salesTrendRaw,
      deliveryAvgRaw,
      staffRows,
      staffDurationRaw,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo }, archivedAt: null },
        _sum: { grandTotal: true },
        _count: { _all: true },
        _avg: { grandTotal: true },
      }),
      prisma.customer.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: thirtyDaysAgo }, archivedAt: null },
        _count: { _all: true },
      }),
      prisma.order.count({
        where: {
          status: 'PENDING',
          archivedAt: null,
          createdAt: { lt: stalePendingBefore },
        },
      }),
      prisma.$queryRaw<ProductAggRow[]>`
        SELECT oi.product_name AS name,
               COALESCE(SUM(oi.quantity), 0)::bigint AS quantity,
               COALESCE(SUM(oi.total_price), 0)::float AS revenue
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= ${thirtyDaysAgo}
          AND o.archived_at IS NULL
        GROUP BY oi.product_name
        ORDER BY revenue DESC
        LIMIT 10
      `,
      prisma.$queryRaw<ProductAggRow[]>`
        SELECT oi.product_name AS name,
               COALESCE(SUM(oi.quantity), 0)::bigint AS quantity,
               COALESCE(SUM(oi.total_price), 0)::float AS revenue
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= ${thirtyDaysAgo}
          AND o.archived_at IS NULL
        GROUP BY oi.product_name
        ORDER BY revenue ASC
        LIMIT 10
      `,
      prisma.$queryRaw<DayAggRow[]>`
        SELECT date_trunc('day', created_at) AS day,
               COUNT(*)::bigint AS orders,
               COALESCE(SUM(grand_total), 0)::float AS revenue
        FROM orders
        WHERE created_at >= ${thirtyDaysAgo}
          AND archived_at IS NULL
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<DeliveryAggRow[]>`
        SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60.0)::float AS avg_minutes
        FROM orders
        WHERE created_at >= ${thirtyDaysAgo}
          AND archived_at IS NULL
          AND status = 'DELIVERED'
      `,
      prisma.staffAccount.findMany({
        where: { active: true, deletedAt: null },
        select: { id: true, name: true },
      }),
      prisma.$queryRaw<StaffDurationRow[]>`
        SELECT assigned_staff_id AS staff_id,
               COUNT(*)::bigint AS assigned,
               COUNT(*) FILTER (WHERE status = 'DELIVERED')::bigint AS delivered,
               AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60.0)::float AS avg_minutes
        FROM orders
        WHERE created_at >= ${thirtyDaysAgo}
          AND archived_at IS NULL
          AND assigned_staff_id IS NOT NULL
        GROUP BY assigned_staff_id
      `,
    ]);

    const trendMap = new Map<string, { revenue: number; orders: number }>();
    for (const row of salesTrendRaw) {
      const day = new Date(row.day).toISOString().slice(0, 10);
      trendMap.set(day, {
        revenue: Number(row.revenue ?? 0),
        orders: Number(row.orders),
      });
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
    const staffPerformance = staffDurationRaw
      .map((row) => {
        const assignedOrders = Number(row.assigned);
        const deliveredOrders = Number(row.delivered);
        return {
          staffId: row.staff_id,
          staffName: staffNameMap.get(row.staff_id) ?? 'Staff',
          assignedOrders,
          deliveredOrders,
          completionRate:
            assignedOrders > 0 ? Math.round((deliveredOrders / assignedOrders) * 10000) / 100 : 0,
          averageHandleMinutes: row.avg_minutes != null ? Math.round(row.avg_minutes) : 0,
        };
      })
      .filter((s) => s.assignedOrders > 0 || s.deliveredOrders > 0)
      .sort((a, b) => b.deliveredOrders - a.deliveredOrders)
      .slice(0, 10);

    const mapProducts = (rows: ProductAggRow[]) =>
      rows.map((p) => ({
        name: p.name,
        quantity: Number(p.quantity),
        revenue: Number(p.revenue ?? 0),
      }));

    const value: AnalyticsOverview = {
      salesLast30Days: orderAgg._sum.grandTotal ?? 0,
      ordersLast30Days: orderAgg._count._all,
      averageBasketValue: orderAgg._avg.grandTotal ?? 0,
      customersLast30Days: customerCount,
      averageDeliveryMinutes: Math.round(Number(deliveryAvgRaw[0]?.avg_minutes ?? 0)),
      statusBreakdown: statusBreakdownRaw.map((s) => ({ status: s.status, count: s._count._all })),
      conversionRate,
      abandonmentRate,
      abandonedOrdersProxy: stalePendingCount,
      checkoutAttemptsProxy,
      topProducts: mapProducts(topProductsRaw),
      lowProducts: mapProducts(lowProductsRaw),
      staffPerformance,
      salesTrend,
      updatedAt: new Date().toISOString(),
    };

    cache = { value, expires: Date.now() + TTL_MS };
    return value;
  }
}
