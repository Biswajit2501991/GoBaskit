import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';

const CACHE_TTL_MS = 60 * 1000;
let cache: { data: DashboardStats; expires: number } | null = null;

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  totalOrders: number;
  totalRevenue: number;
  productCount: number;
  categoryCount: number;
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

export class DashboardService {
  static invalidateCache() {
    cache = null;
  }

  static async getStats(): Promise<DashboardStats> {
    if (cache && cache.expires > Date.now()) {
      return cache.data;
    }

    const todayStart = startOfToday();

    const [
      todayAgg,
      pendingOrders,
      totalAgg,
      productCount,
      categoryCount,
      recentOrders,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: todayStart } },
        _count: { id: true },
        _sum: { grandTotal: true },
      }),
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.order.aggregate({ _count: { id: true }, _sum: { grandTotal: true } }),
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const data: DashboardStats = {
      todayOrders: todayAgg._count.id,
      todayRevenue: todayAgg._sum.grandTotal ?? 0,
      pendingOrders,
      totalOrders: totalAgg._count.id,
      totalRevenue: totalAgg._sum.grandTotal ?? 0,
      productCount,
      categoryCount,
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
