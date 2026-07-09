import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';
import { LOW_STOCK_RATIO } from '@/utils/inventory';

const CACHE_TTL_MS = 3 * 60 * 1000;
let cache: { data: DashboardStats; expires: number } | null = null;

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  processingOrders: number;
  outForDeliveryOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  monthlyRevenue: number;
  totalOrders: number;
  totalRevenue: number;
  customerCount: number;
  productCount: number;
  categoryCount: number;
  lowStockCount: number;
  staffOnline: number;
  unreadNotifications: number;
  pendingWhatsappVerifications: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  dailyTrend: Array<{ day: string; orders: number; revenue: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    grandTotal: number;
    status: string;
    createdAt: string;
    customerName: string;
  }>;
  cachedAt: string;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

type DayAggRow = { day: Date; orders: bigint | number; revenue: number | null };
type TopProductRow = { name: string; quantity: bigint | number; revenue: number | null };

export class DashboardService {
  static invalidateCache() {
    cache = null;
  }

  static async getStats(): Promise<DashboardStats> {
    if (cache && cache.expires > Date.now()) {
      return cache.data;
    }

    const todayStart = startOfToday();
    const monthStart = new Date(todayStart);
    monthStart.setDate(1);
    const onlineThreshold = new Date(Date.now() - 15 * 60 * 1000);
    const trendStart = new Date(todayStart);
    trendStart.setDate(trendStart.getDate() - 6);
    const topProductsSince = new Date(todayStart);
    topProductsSince.setDate(topProductsSince.getDate() - 30);

    const [
      todayAgg,
      monthlyAgg,
      statusCounts,
      totalAgg,
      customerCount,
      productCount,
      categoryCount,
      lowStockCount,
      staffOnline,
      unreadNotifications,
      recentOrders,
      topProductsRaw,
      trendRows,
      pendingWhatsappVerifications,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: todayStart }, archivedAt: null },
        _count: { id: true },
        _sum: { grandTotal: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: monthStart }, archivedAt: null },
        _sum: { grandTotal: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: { archivedAt: null },
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: { archivedAt: null },
        _count: { id: true },
        _sum: { grandTotal: true },
      }),
      prisma.customer.count(),
      prisma.product.count(),
      prisma.category.count(),
      // COUNT in SQL instead of loading every product into Node
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM products
        WHERE status <> 'INACTIVE'
          AND (
            stock <= 0
            OR (
              stock_baseline > 0
              AND stock <= GREATEST(1, CEIL(stock_baseline * ${LOW_STOCK_RATIO}))
            )
          )
      `.then((rows) => Number(rows[0]?.count ?? 0)),
      prisma.staffAccount.count({
        where: { active: true, deletedAt: null, lastLogin: { gte: onlineThreshold } },
      }),
      prisma.adminNotification.count({ where: { readAt: null } }),
      prisma.order.findMany({
        where: { archivedAt: null },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { firstName: true, lastName: true } } },
      }),
      prisma.$queryRaw<TopProductRow[]>`
        SELECT oi.product_name AS name,
               COALESCE(SUM(oi.quantity), 0)::bigint AS quantity,
               COALESCE(SUM(oi.total_price), 0)::float AS revenue
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= ${topProductsSince}
          AND o.archived_at IS NULL
        GROUP BY oi.product_name
        ORDER BY revenue DESC
        LIMIT 5
      `,
      prisma.$queryRaw<DayAggRow[]>`
        SELECT date_trunc('day', created_at) AS day,
               COUNT(*)::bigint AS orders,
               COALESCE(SUM(grand_total), 0)::float AS revenue
        FROM orders
        WHERE created_at >= ${trendStart}
          AND archived_at IS NULL
        GROUP BY 1
        ORDER BY 1
      `,
      // Cheap count — expiry is throttled separately
      prisma.whatsAppVerification.count({
        where: { status: 'PENDING', expiresAt: { gt: new Date() } },
      }),
    ]);

    const statusMap = new Map(statusCounts.map((s) => [s.status, s._count._all]));
    const trendMap = new Map<string, { orders: number; revenue: number }>();
    for (const row of trendRows) {
      const day = new Date(row.day).toISOString().slice(0, 10);
      trendMap.set(day, {
        orders: Number(row.orders),
        revenue: Number(row.revenue ?? 0),
      });
    }
    const dailyTrend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(trendStart);
      d.setDate(trendStart.getDate() + i);
      const day = d.toISOString().slice(0, 10);
      const row = trendMap.get(day) ?? { orders: 0, revenue: 0 };
      return { day, ...row };
    });

    const data: DashboardStats = {
      todayOrders: todayAgg._count.id,
      todayRevenue: todayAgg._sum.grandTotal ?? 0,
      pendingOrders: statusMap.get(OrderStatus.PENDING) ?? 0,
      processingOrders: (statusMap.get(OrderStatus.ACCEPTED) ?? 0) + (statusMap.get(OrderStatus.PACKED) ?? 0),
      outForDeliveryOrders: statusMap.get(OrderStatus.OUT_FOR_DELIVERY) ?? 0,
      deliveredOrders: statusMap.get(OrderStatus.DELIVERED) ?? 0,
      cancelledOrders: statusMap.get(OrderStatus.CANCELLED) ?? 0,
      monthlyRevenue: monthlyAgg._sum.grandTotal ?? 0,
      totalOrders: totalAgg._count.id,
      totalRevenue: totalAgg._sum.grandTotal ?? 0,
      customerCount,
      productCount,
      categoryCount,
      lowStockCount,
      staffOnline,
      unreadNotifications,
      pendingWhatsappVerifications,
      topProducts: topProductsRaw.map((p) => ({
        name: p.name,
        quantity: Number(p.quantity),
        revenue: Number(p.revenue ?? 0),
      })),
      dailyTrend,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        grandTotal: o.grandTotal,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        customerName: `${o.customer.firstName} ${o.customer.lastName}`,
      })),
      cachedAt: new Date().toISOString(),
    };

    cache = { data, expires: Date.now() + CACHE_TTL_MS };
    return data;
  }
}
