import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeMobile } from '@/utils/mobile';
import { isActiveOrderStatus } from '@/utils/orderTracking';
import { canCustomerMutate, customerEditExpiresAt } from '@/utils/orderEditPolicy';
import { CustomerProfileService } from '@/services/CustomerProfileService';
import { OrderArchiveService } from '@/services/OrderArchiveService';
import type { SavedCheckoutProfile } from '@/utils/customerProfile';

export interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  grandTotal: number;
  createdAt: string;
  itemCount: number;
}

export interface CustomerOrderDetail extends CustomerOrderSummary {
  subtotal: number;
  deliveryCharge: number;
  discountAmount: number;
  discountType: 'NONE' | 'COUPON' | 'MEMBERSHIP';
  couponCode: string | null;
  paymentMethod: string;
  deliveryNotes: string | null;
  cancelNotice?: string | null;
  customerVisibleUntil?: string | null;
  editableUntil: string | null;
  canEdit: boolean;
  canCancel: boolean;
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
  }>;
  customer: {
    firstName: string;
    lastName: string;
    mobile: string;
    alternateMobile: string | null;
    houseNumber: string;
    street: string;
    area: string;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
  };
}

function customerMobileWhere(mobile: string) {
  const normalized = normalizeMobile(mobile);
  return {
    OR: [{ mobile: normalized }, { mobile: `91${normalized}` }, { mobile: `+91${normalized}` }],
  };
}

export class CustomerOrderService {
  static async listForMobile(mobile: string, options?: { activeOnly?: boolean }) {
    const orders = await prisma.order.findMany({
      where: {
        customer: customerMobileWhere(mobile),
        ...OrderArchiveService.customerVisibilityFilter(),
        ...(options?.activeOnly
          ? { status: { in: ['PENDING', 'ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY'] }, archivedAt: null }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
      take: options?.activeOnly ? 20 : 10,
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      grandTotal: o.grandTotal,
      createdAt: o.createdAt.toISOString(),
      itemCount: o._count.items,
    })) satisfies CustomerOrderSummary[];
  }

  static async getActiveCount(mobile: string): Promise<number> {
    return prisma.order.count({
      where: {
        customer: customerMobileWhere(mobile),
        archivedAt: null,
        status: { in: ['PENDING', 'ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY'] },
      },
    });
  }

  static async orderCountForMobile(mobile: string): Promise<number> {
    return prisma.order.count({
      where: {
        customer: customerMobileWhere(mobile),
        ...OrderArchiveService.customerVisibilityFilter(),
      },
    });
  }

  /** Orders that exempt a customer from first-time WhatsApp verification. */
  static async completedOrderCountForMobile(mobile: string): Promise<number> {
    return prisma.order.count({
      where: {
        customer: customerMobileWhere(mobile),
        archivedAt: null,
        status: { notIn: ['CANCELLED'] },
      },
    });
  }

  static async getByIdForMobile(orderId: string, mobile: string): Promise<CustomerOrderDetail | null> {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        customer: customerMobileWhere(mobile),
        ...OrderArchiveService.customerVisibilityFilter(),
      },
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
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            productName: true,
            quantity: true,
            unit: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
      },
    });

    if (!order) return null;
    return this.toDetail(order);
  }

  static toDetail(order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    grandTotal: number;
    subtotal: number;
    deliveryCharge: number;
    discountAmount: number;
    discountType: CustomerOrderDetail['discountType'];
    couponCode: string | null;
    paymentMethod: string;
    deliveryNotes: string | null;
    cancelNotice: string | null;
    customerVisibleUntil: Date | null;
    createdAt: Date;
    archivedAt?: Date | null;
    items: CustomerOrderDetail['items'];
    customer: CustomerOrderDetail['customer'];
  }): CustomerOrderDetail {
    const canMutate = canCustomerMutate(order);
    const expires = customerEditExpiresAt(order.createdAt);
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      grandTotal: order.grandTotal,
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      discountAmount: order.discountAmount,
      discountType: order.discountType,
      couponCode: order.couponCode,
      paymentMethod: order.paymentMethod,
      deliveryNotes: order.deliveryNotes,
      cancelNotice: order.cancelNotice,
      customerVisibleUntil: order.customerVisibleUntil?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      itemCount: order.items.length,
      editableUntil: expires.toISOString(),
      canEdit: canMutate,
      canCancel: canMutate,
      items: order.items,
      customer: order.customer,
    };
  }

  static isActiveStatus(status: OrderStatus): boolean {
    return isActiveOrderStatus(status);
  }

  static async getLatestProfileForMobile(mobile: string): Promise<SavedCheckoutProfile | null> {
    const order = await prisma.order.findFirst({
      where: {
        customer: customerMobileWhere(mobile),
        ...OrderArchiveService.customerVisibilityFilter(),
      },
      orderBy: { createdAt: 'desc' },
      include: { customer: true },
    });
    if (!order) return null;
    return CustomerProfileService.profileFromCustomer(order.customer);
  }
}
