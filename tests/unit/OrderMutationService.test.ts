const prismaMock = {
  order: {
    findFirst: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('@/services/SettingsService', () => ({
  SettingsService: { getStoreConfig: jest.fn() },
}));
jest.mock('@/services/DiscountEngine', () => ({
  DiscountEngine: { quoteExistingOrderDiscount: jest.fn() },
}));
jest.mock('@/services/InventoryService', () => ({
  InventoryService: {
    restoreReservationInTx: jest.fn(),
    reserveForOrder: jest.fn(),
    restoreForOrder: jest.fn(),
    afterOrderReserved: jest.fn(),
  },
}));
jest.mock('@/services/OrderService', () => ({
  OrderService: {
    canEditOrder: jest.fn().mockReturnValue(true),
    recordStatusChange: jest.fn(),
  },
}));
jest.mock('@/services/AuditService', () => ({
  AuditService: { log: jest.fn() },
}));
jest.mock('@/services/DashboardService', () => ({
  DashboardService: { invalidateCache: jest.fn() },
}));
jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { invalidateCache: jest.fn() },
}));
jest.mock('@/lib/realtime/eventBus', () => ({
  adminEventBus: { emit: jest.fn() },
}));

jest.mock('next/server', () => ({
  after: (fn: () => void) => {
    void fn();
  },
}));

import { OrderEditError, OrderMutationService } from '@/services/OrderMutationService';
import { InventoryService } from '@/services/InventoryService';

const recent = new Date();

function pendingOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ord1',
    customerId: 'c1',
    status: 'PENDING',
    createdAt: recent,
    updatedAt: recent,
    archivedAt: null,
    stockReserved: true,
    discountType: 'NONE',
    couponCode: null,
    membershipMemberId: null,
    deliveryNotes: null,
    assignedStaffId: null,
    lockedAt: null,
    adminNotes: null,
    items: [{ productId: 'p1', variantId: null, quantity: 1 }],
    customer: {
      firstName: 'Bis',
      lastName: 'Test',
      mobile: '7899813212',
      alternateMobile: null,
      houseNumber: '1',
      street: 'Main',
      area: 'Adra',
      landmark: null,
      city: 'Adra',
      state: 'WB',
      pincode: '723121',
    },
    assignedStaff: null,
    ...overrides,
  };
}

describe('OrderMutationService guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects customer item edits after the window without touching stock', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      pendingOrder({ createdAt: new Date(Date.now() - 11 * 60 * 1000) }),
    );

    await expect(
      OrderMutationService.replaceItems({
        orderId: 'ord1',
        items: [{ productId: 'p1', quantity: 1 }],
        actor: { type: 'customer', mobile: '7899813212' },
      }),
    ).rejects.toBeInstanceOf(OrderEditError);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(InventoryService.restoreForOrder).not.toHaveBeenCalled();
  });

  it('rejects staff item edits once packed', async () => {
    prismaMock.order.findFirst.mockResolvedValue(pendingOrder({ status: 'PACKED' }));

    await expect(
      OrderMutationService.replaceItems({
        orderId: 'ord1',
        items: [{ productId: 'p1', quantity: 2 }],
        actor: {
          type: 'staff',
          staff: { id: 's1', role: 'ALL_SUPER_ADMIN', permissions: [] },
        },
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/packed/i), status: 409 });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('cancels for the customer and restores stock', async () => {
    prismaMock.order.findFirst.mockResolvedValue(pendingOrder());
    prismaMock.order.update.mockResolvedValue({});

    await OrderMutationService.cancelForCustomer('ord1', '7899813212');

    expect(InventoryService.restoreForOrder).toHaveBeenCalledWith('ord1');
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
  });
});
