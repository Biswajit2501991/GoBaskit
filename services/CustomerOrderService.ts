import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeMobile } from '@/utils/mobile';
import { isActiveOrderStatus } from '@/utils/orderTracking';
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
  paymentMethod: string;
  cancelNotice?: string | null;
  customerVisibleUntil?: string | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unit: string;
    totalPrice: number;
  }>;
  customer: {
    firstName: string;
    lastName: string;
    mobile: string;
    city: string;
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
            city: true,
            pincode: true,
          },
        },
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            unit: true,
            totalPrice: true,
          },
        },
      },
    });

    if (!order) return null;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      grandTotal: order.grandTotal,
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      paymentMethod: order.paymentMethod,
      cancelNotice: order.cancelNotice,
      customerVisibleUntil: order.customerVisibleUntil?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      itemCount: order.items.length,
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
