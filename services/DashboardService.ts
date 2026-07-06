import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';
import { InventoryService } from '@/services/InventoryService';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';

const CACHE_TTL_MS = 60 * 1000;
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

    const [
      todayAgg,
      monthlyAgg,
      statusCounts,
      totalAgg,
      customerCount,
      productCount,
      categoryCount,
      lowStockProducts,
      staffOnline,
      unreadNotifications,
      recentOrders,
      topProductsRaw,
      trendOrdersRaw,
      pendingWhatsappVerifications,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: todayStart } },
        _count: { id: true },
        _sum: { grandTotal: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { grandTotal: true },
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.order.aggregate({ _count: { id: true }, _sum: { grandTotal: true } }),
      prisma.customer.count(),
      prisma.product.count(),
      prisma.category.count(),
      prisma.product.findMany({
        where: { status: { not: 'INACTIVE' } },
        select: { stock: true, stockBaseline: true },
      }),
      prisma.staffAccount.count({
        where: { active: true, deletedAt: null, lastLogin: { gte: onlineThreshold } },
      }),
      prisma.adminNotification.count({ where: { readAt: null } }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { firstName: true, lastName: true } } },
      }),
      prisma.orderItem.groupBy({
        by: ['productName'],
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 5,
      }),
      prisma.order.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: trendStart } },
        _count: { _all: true },
        _sum: { grandTotal: true },
      }),
      WhatsAppVerificationService.getPendingCount(),
    ]);

    const statusMap = new Map(statusCounts.map((s) => [s.status, s._count._all]));
    const trendMap = new Map<string, { orders: number; revenue: number }>();
    for (const row of trendOrdersRaw) {
      const day = row.createdAt.toISOString().slice(0, 10);
      const current = trendMap.get(day) ?? { orders: 0, revenue: 0 };
      trendMap.set(day, {
        orders: current.orders + row._count._all,
        revenue: current.revenue + (row._sum.grandTotal ?? 0),
      });
    }
    const dailyTrend = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(trendStart);
      d.setDate(trendStart.getDate() + i);
      const day = d.toISOString().slice(0, 10);
      const row = trendMap.get(day) ?? { orders: 0, revenue: 0 };
      return { day, ...row };
    });

    const lowStockCount = lowStockProducts.filter(
      (p) => p.stock <= 0 || InventoryService.isLowStock(p.stock, p.stockBaseline),
    ).length;

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
        name: p.productName,
        quantity: p._sum.quantity ?? 0,
        revenue: p._sum.totalPrice ?? 0,
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
