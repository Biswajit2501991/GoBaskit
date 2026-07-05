import { prisma } from '@/lib/prisma';
import { adminEventBus } from '@/lib/realtime/eventBus';
import { DashboardService } from '@/services/DashboardService';

export class NotificationService {
  static async notifyNewOrder(order: {
    id: string;
    orderNumber: string;
    grandTotal: number;
    customer: { firstName: string; lastName: string };
  }) {
    const notification = await prisma.adminNotification.create({
      data: {
        type: 'new_order',
        title: 'New Order',
        message: `${order.orderNumber} — ${order.customer.firstName} ${order.customer.lastName} · ₹${order.grandTotal}`,
        entityType: 'orders',
        entityId: order.id,
      },
    });

    DashboardService.invalidateCache();

    adminEventBus.emit({
      type: 'notification_created',
      payload: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        entityType: notification.entityType,
        entityId: notification.entityId,
        createdAt: notification.createdAt.toISOString(),
      },
    });

    return notification;
  }

  static async list(
    staffId: string,
    params: { page?: number; pageSize?: number; unreadOnly?: boolean; type?: string; readState?: 'all' | 'read' | 'unread' },
  ) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 50);

    const where = {
      OR: [{ staffId: null }, { staffId }],
      ...(params.unreadOnly ? { readAt: null } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.readState === 'read'
        ? { readAt: { not: null as Date | null } }
        : params.readState === 'unread'
          ? { readAt: null }
          : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.adminNotification.count({ where }),
      prisma.adminNotification.count({
        where: { OR: [{ staffId: null }, { staffId }], readAt: null },
      }),
    ]);

    return {
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        entityType: n.entityType,
        entityId: n.entityId,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      total,
      unreadCount,
      page,
      pageSize,
    };
  }

  static async markRead(id: string, staffId: string) {
    const notification = await prisma.adminNotification.findFirst({
      where: {
        id,
        OR: [{ staffId: null }, { staffId }],
      },
    });
    if (!notification) return null;

    return prisma.adminNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  static async markAllRead(staffId: string) {
    await prisma.adminNotification.updateMany({
      where: { OR: [{ staffId: null }, { staffId }], readAt: null },
      data: { readAt: new Date() },
    });
  }

  static async markByTypeRead(staffId: string, type: string) {
    await prisma.adminNotification.updateMany({
      where: {
        OR: [{ staffId: null }, { staffId }],
        readAt: null,
        type,
      },
      data: { readAt: new Date() },
    });
  }
}
