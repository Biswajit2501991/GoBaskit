import type { OrderPriority, OrderStatus, Prisma, StaffRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { staffHasPermission, parsePermissions } from '@/types/staff';
import { AuditService } from '@/services/AuditService';
import { adminEventBus } from '@/lib/realtime/eventBus';
import { DashboardService } from '@/services/DashboardService';
import { AnalyticsService } from '@/services/AnalyticsService';
import { InventoryService } from '@/services/InventoryService';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';
import { toE164 } from '@/utils/phone';
import { normalizeMobile } from '@/utils/mobile';
import { ACTIVE_ORDER_STATUSES } from '@/constants/orders';

export interface OrderListParams {
  search?: string;
  status?: OrderStatus;
  /** Staff id, or `unassigned` for orders with no assignee. */
  assignedStaffId?: string;
  /** When true and no status filter, limit to active fulfillment statuses. */
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
  includeHistory?: boolean;
}

export type OrderOpsSummary = {
  unassigned: {
    total: number;
    byStatus: Record<string, number>;
  };
  staff: Array<{
    id: string;
    name: string;
    total: number;
    byStatus: Record<string, number>;
  }>;
};

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
  isWhatsappVerified: true,
} as const;

const staffTimelineSelect = { name: true, mobile: true } as const;

function orderListInclude(includeHistory: boolean) {
  return {
    customer: { select: customerListSelect },
    assignedStaff: { select: { id: true, name: true, mobile: true } },
    items: true,
    ...(includeHistory
      ? {
          statusHistory: {
            orderBy: { createdAt: 'desc' as const },
            take: 10,
            include: { staff: { select: staffTimelineSelect } },
          },
        }
      : {}),
  };
}

function orderPayload(order: {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  grandTotal: number;
  priority: OrderPriority;
  assignedStaffId: string | null;
  lockedAt: Date | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { firstName: string; lastName: string; mobile: string };
  assignedStaff?: { id: string; name: string } | null;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    grandTotal: order.grandTotal,
    priority: order.priority,
    assignedStaffId: order.assignedStaffId,
    assignedStaff: order.assignedStaff ?? null,
    lockedAt: order.lockedAt?.toISOString() ?? null,
    adminNotes: order.adminNotes,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    customer: order.customer,
  };
}

export class OrderService {
  static async list(params: OrderListParams) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 100);
    const where: Prisma.OrderWhereInput = {
      archivedAt: null,
      ...(params.status
        ? { status: params.status }
        : params.activeOnly
          ? { status: { in: ACTIVE_ORDER_STATUSES } }
          : {}),
      ...(params.assignedStaffId === 'unassigned'
        ? { assignedStaffId: null }
        : params.assignedStaffId
          ? { assignedStaffId: params.assignedStaffId }
          : {}),
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
        include: orderListInclude(params.includeHistory === true),
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /** Live active-order counts for the Orders ops strip (excludes delivered/cancelled). */
  static async getOpsSummary(): Promise<OrderOpsSummary> {
    const emptyByStatus = (): Record<string, number> =>
      Object.fromEntries(ACTIVE_ORDER_STATUSES.map((s) => [s, 0]));

    const groups = await prisma.order.groupBy({
      by: ['status', 'assignedStaffId'],
      where: {
        archivedAt: null,
        status: { in: ACTIVE_ORDER_STATUSES },
      },
      _count: { _all: true },
    });

    const unassigned = { total: 0, byStatus: emptyByStatus() };
    const staffMap = new Map<string, { total: number; byStatus: Record<string, number> }>();

    for (const row of groups) {
      const count = row._count._all;
      const status = row.status;
      if (!ACTIVE_ORDER_STATUSES.includes(status)) continue;

      if (!row.assignedStaffId) {
        unassigned.total += count;
        unassigned.byStatus[status] = (unassigned.byStatus[status] ?? 0) + count;
        continue;
      }

      const existing = staffMap.get(row.assignedStaffId) ?? {
        total: 0,
        byStatus: emptyByStatus(),
      };
      existing.total += count;
      existing.byStatus[status] = (existing.byStatus[status] ?? 0) + count;
      staffMap.set(row.assignedStaffId, existing);
    }

    const staffIds = [...staffMap.keys()];
    const staffRows =
      staffIds.length === 0
        ? []
        : await prisma.staffAccount.findMany({
            where: { id: { in: staffIds } },
            select: { id: true, name: true },
          });
    const nameById = new Map(staffRows.map((s) => [s.id, s.name]));

    const staff = staffIds
      .map((id) => {
        const stats = staffMap.get(id)!;
        return {
          id,
          name: nameById.get(id) ?? 'Staff',
          total: stats.total,
          byStatus: stats.byStatus,
        };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    return { unassigned, staff };
  }

  static async getStatusHistory(orderId: string) {
    return prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { staff: { select: staffTimelineSelect } },
    });
  }

  static async recordStatusChange(orderId: string, status: OrderStatus, staffId?: string, note?: string) {
    await prisma.orderStatusHistory.create({
      data: { orderId, status, staffId, note },
    });
  }

  static async assign(orderId: string, staffId: string, actorId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.lockedAt && order.assignedStaffId && order.assignedStaffId !== staffId) {
      throw new Error('Order is locked to another staff member');
    }

    const staff = await prisma.staffAccount.findFirst({
      where: { id: staffId, active: true, deletedAt: null },
    });
    if (!staff) throw new Error('Staff not found');

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { assignedStaffId: staffId, lockedAt: new Date() },
      include: orderListInclude(true),
    });

    await AuditService.log({
      staffId: actorId,
      action: 'order_assigned',
      entity: 'orders',
      entityId: orderId,
      meta: { assignedTo: staffId },
    });

    const payload = orderPayload(updated);
    DashboardService.invalidateCache();
    AnalyticsService.invalidateCache();
    adminEventBus.emit({ type: 'order_updated', payload });
    return updated;
  }

  static async release(orderId: string, actor: { id: string; role: string; permissions: unknown }) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (!order.assignedStaffId) throw new Error('Order is not assigned');

    const perms = parsePermissions(actor.permissions);
    const canOverride = staffHasPermission(actor.role as StaffRole, perms, 'orders:override_lock');
    if (order.assignedStaffId !== actor.id && !canOverride) {
      throw new Error('Only the assigned staff or a super admin can release this order');
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { assignedStaffId: null, lockedAt: null },
      include: orderListInclude(true),
    });

    await AuditService.log({
      staffId: actor.id,
      action: 'order_released',
      entity: 'orders',
      entityId: orderId,
    });

    const payload = orderPayload(updated);
    DashboardService.invalidateCache();
    AnalyticsService.invalidateCache();
    adminEventBus.emit({ type: 'order_updated', payload });
    return updated;
  }

  static canEditOrder(
    order: { assignedStaffId: string | null; lockedAt: Date | null },
    actor: { id: string; role: string; permissions: unknown },
  ): boolean {
    if (!order.assignedStaffId || !order.lockedAt) return true;
    const perms = parsePermissions(actor.permissions);
    if (staffHasPermission(actor.role as StaffRole, perms, 'orders:override_lock')) return true;
    return order.assignedStaffId === actor.id;
  }

  static async update(
    orderId: string,
    data: { status?: OrderStatus; priority?: OrderPriority; adminNotes?: string },
    actor: { id: string; role: string; permissions: unknown },
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { select: { isWhatsappVerified: true, mobile: true } } },
    });
    if (!order) throw new Error('Order not found');
    if (!this.canEditOrder(order, actor)) {
      throw new Error('Order is locked to another staff member');
    }

    if (
      data.status &&
      data.status !== order.status &&
      data.status !== 'CANCELLED' &&
      !order.customer.isWhatsappVerified
    ) {
      // Heal stale Customer flags after delete/re-verify before locking the status change.
      const e164 = toE164('91', normalizeMobile(order.customer.mobile));
      const healed = e164
        ? await WhatsAppVerificationService.syncVerifiedFlagsForMobile(e164)
        : false;
      if (!healed) {
        throw new Error(
          'Customer WhatsApp is not verified yet. Verify the customer before progressing this order.',
        );
      }
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.priority ? { priority: data.priority } : {}),
        ...(data.adminNotes !== undefined ? { adminNotes: data.adminNotes } : {}),
      },
    });

    if (data.status && data.status !== order.status) {
      await this.recordStatusChange(orderId, data.status, actor.id);
      if (data.status === 'CANCELLED' && order.status !== 'CANCELLED') {
        await InventoryService.restoreForOrder(orderId);
      }
    }

    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderListInclude(true),
    });

    await AuditService.log({
      staffId: actor.id,
      action: 'order_updated',
      entity: 'orders',
      entityId: orderId,
      meta: data,
    });

    const payload = orderPayload(updated);
    DashboardService.invalidateCache();
    AnalyticsService.invalidateCache();
    adminEventBus.emit({ type: 'order_updated', payload });
    return updated;
  }

  static async onOrderCreated(order: {
    id: string;
    orderNumber: string;
    grandTotal: number;
    status: OrderStatus;
    customer: { firstName: string; lastName: string };
  }) {
    await this.recordStatusChange(order.id, order.status);
    DashboardService.invalidateCache();
    AnalyticsService.invalidateCache();
    adminEventBus.emit({
      type: 'order_created',
      payload: {
        id: order.id,
        orderNumber: order.orderNumber,
        grandTotal: order.grandTotal,
        status: order.status,
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
      },
    });
  }
}
