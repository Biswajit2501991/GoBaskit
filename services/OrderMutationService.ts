import type { OrderStatus } from '@prisma/client';
import { after } from 'next/server';
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
type MutationActor = { type: 'customer'; mobile: string } | { type: 'staff'; staff: StaffActor };

function deferAfterResponse(work: () => Promise<void>) {
  try {
    after(() => {
      void work();
    });
  } catch {
    void work();
  }
}

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
  subtotal?: number;
  discountAmount?: number;
  discountType?: string;
  couponCode?: string | null;
  deliveryNotes?: string | null;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  assignedStaffId: string | null;
  lockedAt: Date | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: Record<string, unknown>;
  assignedStaff?: { id: string; name: string } | null;
  items?: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
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
      ...(order.subtotal != null ? { subtotal: order.subtotal } : {}),
      ...(order.discountAmount != null ? { discountAmount: order.discountAmount } : {}),
      ...(order.discountType ? { discountType: order.discountType } : {}),
      ...(order.couponCode !== undefined ? { couponCode: order.couponCode } : {}),
      ...(order.deliveryNotes !== undefined ? { deliveryNotes: order.deliveryNotes } : {}),
      priority: order.priority,
      assignedStaffId: order.assignedStaffId,
      assignedStaff: order.assignedStaff ?? null,
      lockedAt: order.lockedAt?.toISOString() ?? null,
      adminNotes: order.adminNotes ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: (order.updatedAt ?? order.createdAt).toISOString(),
      customer: order.customer,
      ...(order.items
        ? {
            items: order.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          }
        : {}),
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
    actor: MutationActor;
  }) {
    return this.saveContents({ ...params, delivery: undefined });
  }

  static async updateDelivery(params: {
    orderId: string;
    delivery: DeliveryPatch;
    actor: MutationActor;
  }) {
    return this.saveContents({ ...params, items: undefined });
  }

  static async saveContents(params: {
    orderId: string;
    items?: OrderLineInput[];
    delivery?: DeliveryPatch;
    actor: MutationActor;
  }) {
    const hasItems = Array.isArray(params.items);
    const hasDelivery = Boolean(params.delivery && typeof params.delivery === 'object');
    if (!hasItems && !hasDelivery) {
      throw new OrderEditError('Nothing to update', 400);
    }

    const order = await this.loadMutableOrder(params.orderId, params.actor);
    if (params.actor.type === 'customer') {
      this.assertCustomerCanMutate(order);
    } else {
      this.assertStaffCanMutateItems(order, params.actor.staff);
    }

    const lines = hasItems ? normalizeLines(params.items!) : null;
    if (lines && !lines.length) {
      throw new OrderEditError('Add at least one item', 400);
    }

    const [named, config] = await Promise.all([
      lines ? this.resolveCatalogLines(lines) : Promise.resolve(null),
      SettingsService.getStoreConfig(),
    ]);

    let subtotal = order.subtotal;
    let deliveryCharge = order.deliveryCharge;
    let quoted = {
      discountAmount: order.discountAmount,
      discountType: order.discountType,
      couponCode: order.couponCode,
      membershipMemberId: order.membershipMemberId,
    };

    if (named) {
      subtotal = named.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      if (config.minOrderValue > 0 && subtotal < config.minOrderValue) {
        throw new OrderEditError(`Minimum order value is ₹${config.minOrderValue}.`, 400);
      }
      quoted = await DiscountEngine.quoteExistingOrderDiscount({
        discountType: order.discountType,
        couponCode: order.couponCode,
        subtotal,
        membershipMemberId: order.membershipMemberId,
      });
      deliveryCharge = deliveryChargeFrom(config.deliverySlabs, subtotal);
    }

    const grandTotal = named
      ? Math.max(0, subtotal - quoted.discountAmount + deliveryCharge)
      : order.grandTotal;

    const deliveryNext = hasDelivery
      ? mergeDelivery(order.customer, order.deliveryNotes, params.delivery!)
      : null;
    if (deliveryNext) {
      const serviceable = deliveryIsServiceable({
        serviceablePins: config.serviceablePins,
        serviceableCities: config.serviceableCities,
        city: deliveryNext.city,
        pincode: deliveryNext.pincode,
        cityAliases: config.cityAliases,
      });
      if (!serviceable) {
        throw new OrderEditError('Sorry, delivery is currently unavailable in your area.', 400);
      }
    }

    const stockItems = named
      ? named.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        }))
      : null;

    let inventoryUpdates: {
      productIds: string[];
      qtyByProduct: Map<string, number>;
      variantIds: string[];
      qtyByVariant: Map<string, number>;
    } | null = null;
    let createdItems = order.items;

    try {
      await prisma.$transaction(
        async (tx) => {
          if (named && stockItems) {
            await InventoryService.restoreReservationInTx(
              tx,
              order.id,
              order.items,
              order.stockReserved,
            );
            await tx.orderItem.deleteMany({ where: { orderId: order.id } });
            createdItems = await tx.orderItem.createManyAndReturn({
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
            inventoryUpdates = await InventoryService.reserveForOrder(tx, order.id, stockItems);
          }

          if (deliveryNext) {
            await tx.customer.update({
              where: { id: order.customerId },
              data: {
                firstName: deliveryNext.firstName,
                lastName: deliveryNext.lastName,
                alternateMobile: deliveryNext.alternateMobile,
                houseNumber: deliveryNext.houseNumber,
                street: deliveryNext.street,
                area: deliveryNext.area,
                landmark: deliveryNext.landmark,
                city: deliveryNext.city,
                state: deliveryNext.state,
                pincode: deliveryNext.pincode,
              },
            });
          }

          await tx.order.update({
            where: { id: order.id },
            data: {
              ...(named
                ? {
                    subtotal,
                    deliveryCharge,
                    discountAmount: quoted.discountAmount,
                    discountType: quoted.discountType,
                    couponCode: quoted.couponCode,
                    membershipMemberId: quoted.membershipMemberId,
                    grandTotal,
                  }
                : {}),
              ...(deliveryNext ? { deliveryNotes: deliveryNext.deliveryNotes } : {}),
            },
          });
        },
        { maxWait: 3000, timeout: 8000 },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update order';
      if (/stock/i.test(message) || /unavailable/i.test(message)) {
        throw new OrderEditError(message, 400);
      }
      throw err;
    }

    const customer = deliveryNext
      ? {
          ...order.customer,
          firstName: deliveryNext.firstName,
          lastName: deliveryNext.lastName,
          alternateMobile: deliveryNext.alternateMobile,
          houseNumber: deliveryNext.houseNumber,
          street: deliveryNext.street,
          area: deliveryNext.area,
          landmark: deliveryNext.landmark,
          city: deliveryNext.city,
          state: deliveryNext.state,
          pincode: deliveryNext.pincode,
        }
      : order.customer;

    const updated = {
      ...order,
      subtotal,
      deliveryCharge,
      discountAmount: quoted.discountAmount,
      discountType: quoted.discountType,
      couponCode: quoted.couponCode,
      membershipMemberId: quoted.membershipMemberId,
      grandTotal,
      deliveryNotes: deliveryNext ? deliveryNext.deliveryNotes : order.deliveryNotes,
      stockReserved: named ? true : order.stockReserved,
      items: createdItems,
      customer,
    };

    emitOrderUpdated(updated);

    const staffId = params.actor.type === 'staff' ? params.actor.staff.id : undefined;
    const notes: string[] = [];
    if (named) {
      notes.push(params.actor.type === 'customer' ? 'Customer updated order items' : 'Staff updated order items');
    }
    if (deliveryNext) {
      notes.push(
        params.actor.type === 'customer'
          ? 'Customer updated delivery details'
          : 'Staff updated delivery details',
      );
    }

    deferAfterResponse(async () => {
      await Promise.allSettled([
        inventoryUpdates
          ? InventoryService.afterOrderReserved(
              inventoryUpdates.productIds,
              inventoryUpdates.qtyByProduct,
              inventoryUpdates.variantIds,
              inventoryUpdates.qtyByVariant,
            )
          : Promise.resolve(),
        ...notes.map((note) => OrderService.recordStatusChange(order.id, order.status, staffId, note)),
        params.actor.type === 'staff'
          ? AuditService.log({
              staffId: params.actor.staff.id,
              action: named && deliveryNext ? 'order_contents_updated' : named ? 'order_items_updated' : 'order_delivery_updated',
              entity: 'orders',
              entityId: order.id,
            })
          : Promise.resolve(),
      ]);
    });

    return updated;
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
    const updated = {
      ...order,
      status: 'CANCELLED' as const,
      cancelNotice: 'Cancelled by customer within the edit window.',
    };
    emitOrderUpdated(updated);
    deferAfterResponse(async () => {
      await OrderService.recordStatusChange(order.id, 'CANCELLED', undefined, 'Cancelled by customer');
    });
    return updated;
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
        items: true,
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
