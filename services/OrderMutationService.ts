import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { deliveryChargeFrom } from '@/constants';
import { deliveryIsServiceable } from '@/utils/delivery';
import { composeOrderItemName } from '@/utils/orderItemName';
import { variantLabel } from '@/utils/variant';
import { normalizeMobile } from '@/utils/mobile';
import {
  canCustomerMutate,
  canStaffMutateItems,
  customerEditDenialMessage,
  customerEditExpiresAt,
  staffItemEditDenialMessage,
} from '@/utils/orderEditPolicy';
import { SettingsService } from '@/services/SettingsService';
import { DiscountEngine } from '@/services/DiscountEngine';
import { InventoryService } from '@/services/InventoryService';
import { OrderService } from '@/services/OrderService';
import { AuditService } from '@/services/AuditService';
import { DashboardService } from '@/services/DashboardService';
import { AnalyticsService } from '@/services/AnalyticsService';
import { adminEventBus } from '@/lib/realtime/eventBus';

export class OrderEditError extends Error {
  constructor(
    message: string,
    public status: number = 409,
  ) {
    super(message);
    this.name = 'OrderEditError';
  }
}

export type OrderLineInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type DeliveryPatch = {
  firstName?: string;
  lastName?: string;
  alternateMobile?: string | null;
  houseNumber?: string;
  street?: string;
  area?: string;
  landmark?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  deliveryNotes?: string | null;
};

type StaffActor = { id: string; role: string; permissions: unknown };

const customerMobileWhere = (mobile: string) => {
  const normalized = normalizeMobile(mobile);
  return {
    OR: [{ mobile: normalized }, { mobile: `91${normalized}` }, { mobile: `+91${normalized}` }],
  };
};

function emitOrderUpdated(order: {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  grandTotal: number;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  assignedStaffId: string | null;
  lockedAt: Date | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { firstName: string; lastName: string; mobile: string };
  assignedStaff?: { id: string; name: string } | null;
}) {
  DashboardService.invalidateCache();
  AnalyticsService.invalidateCache();
  adminEventBus.emit({
    type: 'order_updated',
    payload: {
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
    },
  });
}

export class OrderMutationService {
  static assertCustomerCanMutate(order: {
    status: OrderStatus;
    createdAt: Date;
    archivedAt: Date | null;
  }) {
    if (!canCustomerMutate(order)) {
      throw new OrderEditError(customerEditDenialMessage(order));
    }
  }

  static assertStaffCanMutateItems(
    order: {
      status: OrderStatus;
      createdAt: Date;
      archivedAt: Date | null;
      assignedStaffId: string | null;
      lockedAt: Date | null;
    },
    actor: StaffActor,
  ) {
    if (!canStaffMutateItems(order)) {
      throw new OrderEditError(staffItemEditDenialMessage(order));
    }
    if (!OrderService.canEditOrder(order, actor)) {
      throw new OrderEditError('Order is locked to another staff member', 403);
    }
  }

  static async replaceItems(params: {
    orderId: string;
    items: OrderLineInput[];
    actor: { type: 'customer'; mobile: string } | { type: 'staff'; staff: StaffActor };
  }) {
    const lines = normalizeLines(params.items);
    if (!lines.length) {
      throw new OrderEditError('Add at least one item', 400);
    }

    const order = await this.loadMutableOrder(params.orderId, params.actor);
    if (params.actor.type === 'customer') {
      this.assertCustomerCanMutate(order);
    } else {
      this.assertStaffCanMutateItems(order, params.actor.staff);
    }

    const named = await this.resolveCatalogLines(lines);
    const subtotal = named.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    const config = await SettingsService.getStoreConfig();
    if (config.minOrderValue > 0 && subtotal < config.minOrderValue) {
      throw new OrderEditError(`Minimum order value is ₹${config.minOrderValue}.`, 400);
    }

    const quoted = await DiscountEngine.quoteExistingOrderDiscount({
      discountType: order.discountType,
      couponCode: order.couponCode,
      subtotal,
      membershipMemberId: order.membershipMemberId,
    });
    const deliveryCharge = deliveryChargeFrom(config.deliverySlabs, subtotal);
    const grandTotal = Math.max(0, subtotal - quoted.discountAmount + deliveryCharge);

    const stockItems = named.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }));

    let inventoryUpdates: {
      productIds: string[];
      qtyByProduct: Map<string, number>;
      variantIds: string[];
      qtyByVariant: Map<string, number>;
    };

    try {
      await prisma.$transaction(
        async (tx) => {
          await InventoryService.restoreReservationInTx(
            tx,
            order.id,
            order.items,
            order.stockReserved,
          );
          await tx.orderItem.deleteMany({ where: { orderId: order.id } });
          await tx.orderItem.createMany({
            data: named.map((item) => ({
              orderId: order.id,
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unit: item.unit,
              totalPrice: item.unitPrice * item.quantity,
            })),
          });
          await tx.order.update({
            where: { id: order.id },
            data: {
              subtotal,
              deliveryCharge,
              discountAmount: quoted.discountAmount,
              discountType: quoted.discountType,
              couponCode: quoted.couponCode,
              membershipMemberId: quoted.membershipMemberId,
              grandTotal,
            },
          });
          inventoryUpdates = await InventoryService.reserveForOrder(tx, order.id, stockItems);
        },
        { maxWait: 3000, timeout: 8000 },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update items';
      if (/stock/i.test(message) || /unavailable/i.test(message)) {
        throw new OrderEditError(message, 400);
      }
      throw err;
    }

    const note =
      params.actor.type === 'customer'
        ? 'Customer updated order items'
        : 'Staff updated order items';
    await OrderService.recordStatusChange(
      order.id,
      order.status,
      params.actor.type === 'staff' ? params.actor.staff.id : undefined,
      note,
    );

    if (inventoryUpdates!) {
      await InventoryService.afterOrderReserved(
        inventoryUpdates.productIds,
        inventoryUpdates.qtyByProduct,
        inventoryUpdates.variantIds,
        inventoryUpdates.qtyByVariant,
      );
    }

    if (params.actor.type === 'staff') {
      await AuditService.log({
        staffId: params.actor.staff.id,
        action: 'order_items_updated',
        entity: 'orders',
        entityId: order.id,
      });
    }

    return this.reloadAndEmit(order.id);
  }

  static async updateDelivery(params: {
    orderId: string;
    delivery: DeliveryPatch;
    actor: { type: 'customer'; mobile: string } | { type: 'staff'; staff: StaffActor };
  }) {
    const order = await this.loadMutableOrder(params.orderId, params.actor);
    if (params.actor.type === 'customer') {
      this.assertCustomerCanMutate(order);
    } else {
      this.assertStaffCanMutateItems(order, params.actor.staff);
    }

    const next = mergeDelivery(order.customer, order.deliveryNotes, params.delivery);
    const config = await SettingsService.getStoreConfig();
    const serviceable = deliveryIsServiceable({
      serviceablePins: config.serviceablePins,
      serviceableCities: config.serviceableCities,
      city: next.city,
      pincode: next.pincode,
      cityAliases: config.cityAliases,
    });
    if (!serviceable) {
      throw new OrderEditError('Sorry, delivery is currently unavailable in your area.', 400);
    }

    await prisma.$transaction([
      prisma.customer.update({
        where: { id: order.customerId },
        data: {
          firstName: next.firstName,
          lastName: next.lastName,
          alternateMobile: next.alternateMobile,
          houseNumber: next.houseNumber,
          street: next.street,
          area: next.area,
          landmark: next.landmark,
          city: next.city,
          state: next.state,
          pincode: next.pincode,
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { deliveryNotes: next.deliveryNotes },
      }),
    ]);

    const note =
      params.actor.type === 'customer'
        ? 'Customer updated delivery details'
        : 'Staff updated delivery details';
    await OrderService.recordStatusChange(
      order.id,
      order.status,
      params.actor.type === 'staff' ? params.actor.staff.id : undefined,
      note,
    );

    if (params.actor.type === 'staff') {
      await AuditService.log({
        staffId: params.actor.staff.id,
        action: 'order_delivery_updated',
        entity: 'orders',
        entityId: order.id,
      });
    }

    return this.reloadAndEmit(order.id);
  }

  static async cancelForCustomer(orderId: string, mobile: string) {
    const order = await this.loadMutableOrder(orderId, { type: 'customer', mobile });
    this.assertCustomerCanMutate(order);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        cancelNotice: 'Cancelled by customer within the edit window.',
      },
    });
    await InventoryService.restoreForOrder(order.id);
    await OrderService.recordStatusChange(order.id, 'CANCELLED', undefined, 'Cancelled by customer');

    return this.reloadAndEmit(order.id);
  }

  private static async loadMutableOrder(
    orderId: string,
    actor: { type: 'customer'; mobile: string } | { type: 'staff'; staff: StaffActor },
  ) {
    const order = await prisma.order.findFirst({
      where:
        actor.type === 'customer'
          ? { id: orderId, customer: customerMobileWhere(actor.mobile), archivedAt: null }
          : { id: orderId, archivedAt: null },
      include: {
        customer: true,
        items: {
          select: { productId: true, variantId: true, quantity: true },
        },
        assignedStaff: { select: { id: true, name: true } },
      },
    });
    if (!order) {
      throw new OrderEditError('Order not found', 404);
    }
    return order;
  }

  private static async resolveCatalogLines(lines: OrderLineInput[]) {
    const productIds = [...new Set(lines.map((l) => l.productId))];
    const variantIds = [
      ...new Set(lines.map((l) => l.variantId).filter((id): id is string => Boolean(id))),
    ];

    const [products, variants] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, price: true, unit: true, status: true },
      }),
      variantIds.length
        ? prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              productId: true,
              price: true,
              unit: true,
              brand: true,
              variantName: true,
              weight: true,
              isActive: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const productById = new Map(products.map((p) => [p.id, p]));
    const variantById = new Map(variants.map((v) => [v.id, v]));

    return lines.map((line) => {
      const product = productById.get(line.productId);
      if (!product) {
        throw new OrderEditError('A product is no longer available.', 400);
      }
      if (product.status === 'INACTIVE') {
        throw new OrderEditError(`${product.name} is currently unavailable.`, 400);
      }

      const variant = line.variantId ? variantById.get(line.variantId) : null;
      if (line.variantId && (!variant || variant.productId !== line.productId || !variant.isActive)) {
        throw new OrderEditError(`${product.name} option is no longer available.`, 400);
      }

      const unitPrice = variant ? variant.price : product.price;
      const unit = (variant?.unit || product.unit || 'pcs').trim() || 'pcs';
      return {
        productId: line.productId,
        variantId: line.variantId ?? null,
        quantity: line.quantity,
        unitPrice,
        unit,
        productName: composeOrderItemName({
          productName: product.name,
          variantLabel: variant ? variantLabel(variant) : null,
          clientName: product.name,
        }),
      };
    });
  }

  private static async reloadAndEmit(orderId: string) {
    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        customer: {
          select: {
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
          },
        },
        items: true,
        assignedStaff: { select: { id: true, name: true } },
      },
    });
    emitOrderUpdated(updated);
    return updated;
  }
}

function normalizeLines(items: OrderLineInput[]): OrderLineInput[] {
  const merged = new Map<string, OrderLineInput>();
  for (const item of items) {
    const productId = typeof item.productId === 'string' ? item.productId.trim() : '';
    const variantId =
      typeof item.variantId === 'string' && item.variantId.trim() ? item.variantId.trim() : null;
    const quantity = Math.floor(Number(item.quantity));
    if (!productId || !Number.isFinite(quantity) || quantity < 1) {
      throw new OrderEditError('Each item needs a product and a quantity of at least 1', 400);
    }
    const key = `${productId}::${variantId ?? ''}`;
    const prev = merged.get(key);
    merged.set(key, {
      productId,
      variantId,
      quantity: (prev?.quantity ?? 0) + quantity,
    });
  }
  return [...merged.values()];
}

function mergeDelivery(
  customer: {
    firstName: string;
    lastName: string;
    alternateMobile: string | null;
    houseNumber: string;
    street: string;
    area: string;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
  },
  deliveryNotes: string | null,
  patch: DeliveryPatch,
) {
  const firstName = (patch.firstName ?? customer.firstName).trim();
  const lastName = (patch.lastName ?? customer.lastName).trim();
  const houseNumber = (patch.houseNumber ?? customer.houseNumber).trim();
  const street = (patch.street ?? customer.street).trim();
  const area = (patch.area ?? customer.area).trim();
  const city = (patch.city ?? customer.city).trim();
  const state = (patch.state ?? customer.state).trim();
  const pincode = (patch.pincode ?? customer.pincode).trim();
  if (firstName.length < 2 || lastName.length < 2) {
    throw new OrderEditError('Enter a valid name', 400);
  }
  if (!houseNumber || street.length < 2 || area.length < 2 || city.length < 2 || state.length < 2) {
    throw new OrderEditError('Enter a complete delivery address', 400);
  }
  if (pincode && !/^\d{6}$/.test(pincode)) {
    throw new OrderEditError('Enter a valid 6-digit pincode', 400);
  }
  let alternateMobile = customer.alternateMobile;
  if (patch.alternateMobile !== undefined) {
    const alt = (patch.alternateMobile ?? '').trim();
    if (alt && !/^\d{10}$/.test(alt)) {
      throw new OrderEditError('Enter a valid 10-digit alternate number', 400);
    }
    alternateMobile = alt || null;
  }
  return {
    firstName,
    lastName,
    alternateMobile,
    houseNumber,
    street,
    area,
    landmark:
      patch.landmark !== undefined ? (patch.landmark || '').trim() || null : customer.landmark,
    city,
    state,
    pincode,
    deliveryNotes:
      patch.deliveryNotes !== undefined
        ? (patch.deliveryNotes || '').trim() || null
        : deliveryNotes,
  };
}
