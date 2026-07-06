import type { PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { adminEventBus } from '@/lib/realtime/eventBus';
import { DashboardService } from '@/services/DashboardService';
import { SettingsService } from '@/services/SettingsService';
import { StaffAssignmentService } from '@/services/StaffAssignmentService';
import { formatCustomerName } from '@/utils/customer';
import { PAYMENT_METHODS } from '@/constants';

export interface NewOrderNotificationInput {
  id: string;
  orderNumber: string;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  orderSource?: string;
  customer: {
    firstName: string;
    lastName: string;
    mobile: string;
    city: string;
    houseNumber: string;
    street: string;
    area: string;
    pincode: string;
  };
  customerLat?: number | null;
  customerLng?: number | null;
}

function formatAddress(customer: NewOrderNotificationInput['customer']): string {
  return [customer.houseNumber, customer.street, customer.area, customer.city, customer.pincode]
    .filter(Boolean)
    .join(', ');
}

function buildOrderMessage(order: NewOrderNotificationInput): string {
  const name = formatCustomerName(order.customer.firstName, order.customer.lastName);
  const payment = PAYMENT_METHODS[order.paymentMethod] ?? order.paymentMethod;
  const source = order.orderSource === 'whatsapp' ? 'WhatsApp' : 'Website';
  const time = new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return [
    `${order.orderNumber} · ${name}`,
    `+91 ${order.customer.mobile} · ${order.customer.city}`,
    `₹${order.grandTotal} · ${payment} · ${source}`,
    formatAddress(order.customer),
    time,
  ].join('\n');
}

async function emitNotification(notification: {
  id: string;
  staffId: string | null;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
}) {
  adminEventBus.emit({
    type: 'notification_created',
    payload: {
      id: notification.id,
      staffId: notification.staffId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType,
      entityId: notification.entityId,
      createdAt: notification.createdAt.toISOString(),
    },
  });
}

export class NotificationService {
  static async notifyNewOrder(order: NewOrderNotificationInput) {
    const config = await SettingsService.getStoreConfig();
    const message = buildOrderMessage(order);
    const title = `New Order · ${order.orderNumber}`;

    const recipientIds = await StaffAssignmentService.getNotificationRecipients({
      city: order.customer.city,
      pincode: order.customer.pincode,
      latitude: order.customerLat,
      longitude: order.customerLng,
      cityAliases: config.cityAliases,
      serviceableCities: config.serviceableCities,
    });

    const notifications = await Promise.all(
      recipientIds.map((staffId) =>
        prisma.adminNotification.create({
          data: {
            staffId,
            type: 'new_order',
            title,
            message,
            entityType: 'orders',
            entityId: order.id,
          },
        }),
      ),
    );

    DashboardService.invalidateCache();

    for (const notification of notifications) {
      await emitNotification(notification);
    }

    return notifications;
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
