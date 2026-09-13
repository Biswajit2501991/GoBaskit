import type { StaffRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AuditService } from '@/services/AuditService';
import { NotificationService } from '@/services/NotificationService';
import { adminEventBus } from '@/lib/realtime/eventBus';
import { fulfillmentTicket, generateShopHandoverPin, isSixDigitPin, shopHandoverLookupKey } from '@/lib/shopSourcing';
import { formatCurrency } from '@/utils/formatter';
import { sealStaffPassword, openStaffPassword } from '@/lib/staff-password-vault';
import { ShopSourcingError, ShopSourcingService } from '@/services/ShopSourcingService';
import { staffHasPermission, parsePermissions } from '@/types/staff';

export class ShopHandoverService {
  static canRevealCode(
    order: { assignedStaffId: string | null },
    actor: { id: string; role: StaffRole; permissions: unknown },
  ): boolean {
    if (order.assignedStaffId === actor.id) return true;
    const perms = parsePermissions(actor.permissions);
    return staffHasPermission(actor.role, perms, 'orders:override_lock');
  }

  static async ensureCode(orderId: string) {
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, shopHandoverPinLookup: true, assignedStaffId: true },
    });
    if (!existing || !existing.assignedStaffId || existing.shopHandoverPinLookup) return;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const pin = generateShopHandoverPin();
      const lookup = shopHandoverLookupKey(pin);
      try {
        const written = await prisma.order.updateMany({
          where: { id: orderId, shopHandoverPinLookup: null },
          data: {
            shopHandoverPinLookup: lookup,
            shopHandoverPinVault: sealStaffPassword(pin),
            shopHandoverGeneratedAt: new Date(),
          },
        });
        if (written.count === 1) return;
        return;
      } catch {
        /* unique collision — try another pin */
      }
    }
  }

  static async revealCode(
    orderId: string,
    actor: { id: string; role: StaffRole; permissions: unknown },
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { assignedStaffId: true, shopHandoverPinVault: true, shopHandoverPinLookup: true },
    });
    if (!order) throw new ShopSourcingError('Order not found', 404);
    if (!this.canRevealCode(order, actor)) {
      return { code: null as string | null, ready: Boolean(order.shopHandoverPinLookup), hidden: true };
    }
    if (!order.shopHandoverPinLookup) {
      return { code: null as string | null, ready: false, hidden: false };
    }
    return { code: openStaffPassword(order.shopHandoverPinVault), ready: true, hidden: false };
  }

  static async verifyForShop(shopId: string, rawPin: string) {
    if (!isSixDigitPin(rawPin)) {
      throw new ShopSourcingError('Enter the 6-digit shop code from the delivery partner');
    }
    const lookup = shopHandoverLookupKey(rawPin.trim());
    const order = await prisma.order.findFirst({
      where: { shopHandoverPinLookup: lookup, archivedAt: null },
      select: {
        id: true,
        orderNumber: true,
        assignedStaff: { select: { id: true, name: true } },
        shopFulfillments: {
          where: { shopId, status: { not: 'CANCELLED' } },
          select: {
            id: true,
            suffix: true,
            costToGobaskit: true,
            costConfirmedAt: true,
            paymentStatus: true,
          },
          orderBy: { suffix: 'asc' },
        },
      },
    });
    const fulfillment = order?.shopFulfillments[0];
    if (!order || !fulfillment) {
      throw new ShopSourcingError('That code does not match an order for this shop', 404);
    }
    if (!fulfillment.costConfirmedAt) {
      throw new ShopSourcingError('Confirm item costs before the staff handover');
    }
    await prisma.shopFulfillment.update({
      where: { id: fulfillment.id },
      data: { handoverVerifiedAt: new Date() },
    });
    return {
      fulfillmentId: fulfillment.id,
      ticket: fulfillmentTicket(order.orderNumber, fulfillment.suffix),
      amount: Number(fulfillment.costToGobaskit),
      paymentStatus: fulfillment.paymentStatus,
      staffName: order.assignedStaff?.name?.trim() || 'Assigned staff',
      orderId: order.id,
    };
  }

  static async markPayment(params: {
    fulfillmentId: string;
    paymentStatus: 'PAID' | 'PENDING';
    shopId?: string;
    actorId: string;
    mode: 'shop' | 'admin';
  }) {
    const fulfillment = await prisma.shopFulfillment.findFirst({
      where: {
        id: params.fulfillmentId,
        ...(params.mode === 'shop' && params.shopId ? { shopId: params.shopId } : {}),
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        shopId: true,
        orderId: true,
        suffix: true,
        costToGobaskit: true,
        costConfirmedAt: true,
        paymentStatus: true,
        handoverVerifiedAt: true,
        order: {
          select: {
            orderNumber: true,
            assignedStaff: { select: { name: true } },
          },
        },
      },
    });
    if (!fulfillment) throw new ShopSourcingError('Pickup not found', 404);
    if (params.mode === 'shop' && params.shopId && fulfillment.shopId !== params.shopId) {
      throw new ShopSourcingError('Pickup not found', 404);
    }
    if (!fulfillment.costConfirmedAt) {
      throw new ShopSourcingError('Confirm item costs first');
    }
    if (params.mode === 'shop' && !fulfillment.handoverVerifiedAt) {
      throw new ShopSourcingError('Enter the 6-digit shop code first');
    }

    const now = new Date();
    await prisma.shopFulfillment.update({
      where: { id: fulfillment.id },
      data: {
        paymentStatus: params.paymentStatus,
        paymentMarkedAt: now,
        handoverVerifiedAt: fulfillment.handoverVerifiedAt ?? now,
      },
    });

    await AuditService.log({
      staffId: params.actorId,
      action: 'shop_payment_marked',
      entity: 'shop_fulfillments',
      entityId: fulfillment.id,
      meta: { paymentStatus: params.paymentStatus, orderId: fulfillment.orderId },
    });

    const ticket = fulfillmentTicket(fulfillment.order.orderNumber, fulfillment.suffix);
    const amount = Number(fulfillment.costToGobaskit);
    const staffName = fulfillment.order.assignedStaff?.name?.trim() || 'Assigned staff';
    if (params.paymentStatus === 'PENDING') {
      await NotificationService.notifyShopPaymentPending({
        orderId: fulfillment.orderId,
        title: `Pending payment to shop · ${ticket}`,
        message: `Pending payment by ${staffName} · ${formatCurrency(amount)}`,
      });
    }

    adminEventBus.emit({
      type: 'order_updated',
      payload: { id: fulfillment.orderId, shopFulfillmentId: fulfillment.id },
    });

    const rows = await ShopSourcingService.staffCart(fulfillment.orderId);
    return ShopSourcingService.serializeFulfillments(rows, fulfillment.order.orderNumber);
  }
}
