import type { PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { adminEventBus } from '@/lib/realtime/eventBus';
import { DashboardService } from '@/services/DashboardService';
import { SettingsService } from '@/services/SettingsService';
import { StaffAssignmentService } from '@/services/StaffAssignmentService';
import { formatCustomerName } from '@/utils/customer';
import { PAYMENT_METHODS } from '@/constants';
import { parsePermissions, staffHasPermission } from '@/types/staff';
import type { StaffRole } from '@prisma/client';
import { InventoryService } from '@/services/InventoryService';
import { AdminPushService } from '@/services/AdminPushService';

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

    // System popup + sound even when admin browser is minimized (Web Push).
    const name = formatCustomerName(order.customer.firstName, order.customer.lastName);
    void AdminPushService.notifyStaffIds(recipientIds, {
      title: `New Order · ${order.orderNumber}`,
      body: `${name} · ₹${order.grandTotal} · ${order.customer.city}`,
      url: '/admin/orders',
      tag: `order-${order.id}`,
    });

    return notifications;
  }

  static async getInventoryNotificationRecipients(): Promise<string[]> {
    const staff = await prisma.staffAccount.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, role: true, permissions: true },
    });

    return staff
      .filter((member) => {
        if (member.role === 'SUPER_ADMIN' || member.role === 'INVENTORY_MANAGER' || member.role === 'MANAGER') {
          return true;
        }
        const perms = parsePermissions(member.permissions);
        return staffHasPermission(member.role as StaffRole, perms, 'products:edit');
      })
      .map((member) => member.id);
  }

  static async notifyLowStock(product: {
    id: string;
    name: string;
    stock: number;
    stockBaseline: number;
  }) {
    const threshold = InventoryService.lowStockThreshold(product.stockBaseline);
    const title = `Low Stock · ${product.name}`;
    const message = [
      `${product.name} has only ${product.stock} unit${product.stock === 1 ? '' : 's'} left`,
      `(≤25% of ${product.stockBaseline} stocked). Please update inventory.`,
    ].join(' — ');

    await this.createInventoryNotifications('low_stock', title, message, product.id);
  }

  static async notifyOutOfStock(product: { id: string; name: string }) {
    const title = `Out of Stock · ${product.name}`;
    const message = `${product.name} is now out of stock and hidden from customers until restocked.`;

    await this.createInventoryNotifications('out_of_stock', title, message, product.id);
  }

  private static async createInventoryNotifications(
    type: string,
    title: string,
    message: string,
    productId: string,
  ) {
    const recipientIds = await this.getInventoryNotificationRecipients();
    if (!recipientIds.length) return [];

    const notifications = await Promise.all(
      recipientIds.map((staffId) =>
        prisma.adminNotification.create({
          data: {
            staffId,
            type,
            title,
            message,
            entityType: 'products',
            entityId: productId,
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

  static async deleteAll(staffId: string) {
    await prisma.adminNotification.deleteMany({
      where: { OR: [{ staffId: null }, { staffId }] },
    });
  }
}
