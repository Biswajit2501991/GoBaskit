import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  addHours,
  BULK_CANCEL_CUSTOMER_MESSAGE,
  CUSTOMER_ORDER_VISIBLE_HOURS,
  ORDER_ARCHIVE_RETENTION_HOURS,
} from '@/constants/orderArchive';
import { AuditService } from '@/services/AuditService';
import { CustomerNoticeService } from '@/services/CustomerNoticeService';
import { DashboardService } from '@/services/DashboardService';
import { AnalyticsService } from '@/services/AnalyticsService';
import { InventoryService } from '@/services/InventoryService';
import { OrderService } from '@/services/OrderService';
import { SmsService } from '@/services/SmsService';
import { adminEventBus } from '@/lib/realtime/eventBus';
import { normalizeMobile } from '@/utils/mobile';

const customerListSelect = {
  firstName: true,
  lastName: true,
  mobile: true,
  alternateMobile: true,
  houseNumber: true,
  street: true,
  area: true,
  landmark: true,
  city: true,
  state: true,
  pincode: true,
} as const;

export class OrderArchiveService {
  static customerVisibilityFilter(now = new Date()): Prisma.OrderWhereInput {
    return {
      OR: [{ archivedAt: null }, { customerVisibleUntil: { gt: now } }],
    };
  }

  static activeAdminFilter(): Prisma.OrderWhereInput {
    return { archivedAt: null };
  }

  static archivedAdminFilter(now = new Date()): Prisma.OrderWhereInput {
    return {
      archivedAt: { not: null },
      purgeAt: { gt: now },
    };
  }

  static async archiveAllOrders(actorId: string) {
    const orders = await prisma.order.findMany({
      where: { archivedAt: null },
      include: { customer: { select: customerListSelect } },
      orderBy: { createdAt: 'asc' },
    });

    const result = await this.archiveOrderRecords(
      orders,
      actorId,
      'Bulk archived by admin — unavailability or product quality',
    );

    await AuditService.log({
      staffId: actorId,
      action: 'orders_archive_all',
      entity: 'orders',
      meta: result,
    });

    DashboardService.invalidateCache();
    AnalyticsService.invalidateCache();
    adminEventBus.emit({ type: 'orders_archived', payload: { archivedCount: result.archivedCount } });

    return { archivedCount: result.archivedCount, smsRecipients: result.smsRecipients };
  }

  static async archiveOrdersByIds(orderIds: string[], actorId: string) {
    const uniqueIds = [...new Set(orderIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      throw new Error('Select at least one order to delete');
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: uniqueIds }, archivedAt: null },
      include: { customer: { select: customerListSelect } },
      orderBy: { createdAt: 'asc' },
    });

    if (orders.length === 0) {
      throw new Error('No active orders found for the selected items');
    }

    const result = await this.archiveOrderRecords(
      orders,
      actorId,
      'Archived by admin — unavailability or product quality',
    );

    await AuditService.log({
      staffId: actorId,
      action: 'orders_archive_selected',
      entity: 'orders',
      meta: { ...result, orderIds: orders.map((o) => o.id) },
    });

    DashboardService.invalidateCache();
    AnalyticsService.invalidateCache();
    adminEventBus.emit({ type: 'orders_archived', payload: { archivedCount: result.archivedCount } });

    return { archivedCount: result.archivedCount, smsRecipients: result.smsRecipients };
  }

  private static async archiveOrderRecords(
    orders: Array<{
      id: string;
      orderNumber: string;
      status: OrderStatus;
      stockReserved: boolean;
      customer: { mobile: string };
    }>,
    actorId: string,
    historyNote: string,
  ) {
    const now = new Date();
    const customerVisibleUntil = addHours(now, CUSTOMER_ORDER_VISIBLE_HOURS);
    const purgeAt = addHours(now, ORDER_ARCHIVE_RETENTION_HOURS);
    const smsSentMobiles = new Set<string>();
    let archivedCount = 0;

    for (const order of orders) {
      if (order.status !== 'CANCELLED' && order.stockReserved) {
        await InventoryService.restoreForOrder(order.id);
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          archivedAt: now,
          customerVisibleUntil,
          purgeAt,
          cancelNotice: BULK_CANCEL_CUSTOMER_MESSAGE,
          assignedStaffId: null,
          lockedAt: null,
        },
      });

      await OrderService.recordStatusChange(order.id, 'CANCELLED', actorId, historyNote);

      const mobile = normalizeMobile(order.customer.mobile);
      const noticeMessage = `${BULK_CANCEL_CUSTOMER_MESSAGE} Order ${order.orderNumber}.`;

      await CustomerNoticeService.create({
        mobile,
        message: noticeMessage,
        expiresAt: customerVisibleUntil,
        orderId: order.id,
      });

      if (!smsSentMobiles.has(mobile)) {
        const sent = await SmsService.send(mobile, noticeMessage);
        smsSentMobiles.add(mobile);
        if (sent) {
          await prisma.order.update({
            where: { id: order.id },
            data: { smsSentAt: now },
          });
        }
      }

      archivedCount += 1;
    }

    return {
      archivedCount,
      smsRecipients: smsSentMobiles.size,
      customerVisibleUntil: customerVisibleUntil.toISOString(),
      purgeAt: purgeAt.toISOString(),
    };
  }

  static async listArchived(params: { search?: string; page?: number; pageSize?: number }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 100);
    const now = new Date();

    const where: Prisma.OrderWhereInput = {
      ...this.archivedAdminFilter(now),
      ...(params.search
        ? {
            OR: [
              { orderNumber: { contains: params.search, mode: 'insensitive' } },
              { customer: { firstName: { contains: params.search, mode: 'insensitive' } } },
              { customer: { lastName: { contains: params.search, mode: 'insensitive' } } },
              { customer: { mobile: { contains: params.search } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: customerListSelect },
          items: true,
        },
        orderBy: { archivedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      items: items.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status as OrderStatus,
        grandTotal: order.grandTotal,
        archivedAt: order.archivedAt?.toISOString() ?? null,
        customerVisibleUntil: order.customerVisibleUntil?.toISOString() ?? null,
        purgeAt: order.purgeAt?.toISOString() ?? null,
        cancelNotice: order.cancelNotice,
        smsSentAt: order.smsSentAt?.toISOString() ?? null,
        createdAt: order.createdAt.toISOString(),
        customer: order.customer,
        items: order.items,
      })),
      total,
      page,
      pageSize,
    };
  }

  static async purgeExpiredOrders() {
    const now = new Date();
    const expired = await prisma.order.findMany({
      where: {
        archivedAt: { not: null },
        purgeAt: { lte: now },
      },
      select: { id: true },
    });

    if (expired.length === 0) {
      await CustomerNoticeService.purgeExpired();
      return { purgedOrders: 0, purgedNotices: 0 };
    }

    await prisma.order.deleteMany({
      where: { id: { in: expired.map((o) => o.id) } },
    });

    const purgedNotices = await CustomerNoticeService.purgeExpired();

    DashboardService.invalidateCache();
    AnalyticsService.invalidateCache();

    return { purgedOrders: expired.length, purgedNotices };
  }
}
