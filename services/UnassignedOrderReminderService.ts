import { prisma } from '@/lib/prisma';
import { staffOrderDeepLink } from '@/lib/adminDeepLink';
import { formatCustomerName } from '@/utils/customer';
import { AdminPushService } from '@/services/AdminPushService';
import { StaffAssignmentService } from '@/services/StaffAssignmentService';
import {
  ACTIVE_ORDER_STATUSES,
  UNASSIGNED_PUSH_REMINDER_INTERVAL_MS,
  UNASSIGNED_PUSH_REMINDER_LOOKBACK_MS,
  UNASSIGNED_PUSH_REMINDER_MAX,
} from '@/constants/orders';

export type UnassignedReminderDueInput = {
  id: string;
  assignedStaffId: string | null;
  archivedAt: Date | null;
  status: string;
  createdAt: Date;
  unassignedPushReminders: number;
  lastUnassignedPushAt: Date | null;
};

export function isUnassignedReminderDue(
  order: UnassignedReminderDueInput,
  nowMs: number,
): boolean {
  if (order.assignedStaffId) return false;
  if (order.archivedAt) return false;
  if (!ACTIVE_ORDER_STATUSES.includes(order.status as (typeof ACTIVE_ORDER_STATUSES)[number])) {
    return false;
  }
  if (order.unassignedPushReminders >= UNASSIGNED_PUSH_REMINDER_MAX) return false;
  if (nowMs - order.createdAt.getTime() > UNASSIGNED_PUSH_REMINDER_LOOKBACK_MS) return false;
  const lastAt = order.lastUnassignedPushAt?.getTime() ?? order.createdAt.getTime();
  return nowMs - lastAt >= UNASSIGNED_PUSH_REMINDER_INTERVAL_MS;
}

export class UnassignedOrderReminderService {
  static async remindDue(now = new Date()): Promise<{ scanned: number; reminded: number }> {
    if (!AdminPushService.isConfigured()) {
      return { scanned: 0, reminded: 0 };
    }

    const nowMs = now.getTime();
    const lookbackStart = new Date(nowMs - UNASSIGNED_PUSH_REMINDER_LOOKBACK_MS);
    const intervalAgo = new Date(nowMs - UNASSIGNED_PUSH_REMINDER_INTERVAL_MS);

    const candidates = await prisma.order.findMany({
      where: {
        assignedStaffId: null,
        archivedAt: null,
        status: { in: [...ACTIVE_ORDER_STATUSES] },
        unassignedPushReminders: { lt: UNASSIGNED_PUSH_REMINDER_MAX },
        createdAt: { gte: lookbackStart, lte: intervalAgo },
        OR: [{ lastUnassignedPushAt: null }, { lastUnassignedPushAt: { lte: intervalAgo } }],
      },
      select: {
        id: true,
        orderNumber: true,
        grandTotal: true,
        assignedStaffId: true,
        archivedAt: true,
        status: true,
        createdAt: true,
        unassignedPushReminders: true,
        lastUnassignedPushAt: true,
        customer: { select: { firstName: true, lastName: true, city: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });

    const due = candidates.filter((order) => isUnassignedReminderDue(order, nowMs));
    if (!due.length) return { scanned: candidates.length, reminded: 0 };

    const recipientIds = await StaffAssignmentService.getOrderCapableStaffIds();
    if (!recipientIds.length) return { scanned: candidates.length, reminded: 0 };

    let reminded = 0;
    for (const order of due) {
      const claimed = await prisma.order.updateMany({
        where: {
          id: order.id,
          assignedStaffId: null,
          archivedAt: null,
          unassignedPushReminders: { lt: UNASSIGNED_PUSH_REMINDER_MAX },
          OR: [{ lastUnassignedPushAt: null }, { lastUnassignedPushAt: { lte: intervalAgo } }],
        },
        data: {
          unassignedPushReminders: { increment: 1 },
          lastUnassignedPushAt: now,
        },
      });
      if (claimed.count !== 1) continue;

      const name = formatCustomerName(order.customer.firstName, order.customer.lastName);
      await AdminPushService.notifyStaffIds(recipientIds, {
        title: `Unassigned · ${order.orderNumber}`,
        body: `${name} · ₹${order.grandTotal} · ${order.customer.city} — still waiting for staff`,
        url: staffOrderDeepLink(order.id),
        tag: `order-${order.id}`,
      });
      reminded += 1;
    }

    return { scanned: candidates.length, reminded };
  }
}
