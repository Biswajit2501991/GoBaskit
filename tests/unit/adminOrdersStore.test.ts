import {
  adminOrdersBoardKey,
  patchOrderFromEvent,
  useAdminOrdersStore,
} from '@/store/adminOrdersStore';
import { peekAdminQuery, useAdminSessionStore } from '@/store/adminSessionCache';

const params = {
  page: 1,
  search: '',
  scope: 'all' as const,
  staffId: 'admin-1',
  opsFilter: null,
};

describe('adminOrdersStore', () => {
  beforeEach(() => {
    useAdminOrdersStore.getState().invalidateOrders();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not refetch a fresh board when nothing changed', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: 'o1', status: 'PENDING' }], total: 1 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await useAdminOrdersStore.getState().fetchBoard(params);
    await useAdminOrdersStore.getState().fetchBoard(params);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(peekAdminQuery(adminOrdersBoardKey(params))?.data).toEqual({
      items: [{ id: 'o1', status: 'PENDING' }],
      total: 1,
    });
  });

  it('refetches after a create event marks the board dirty', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'o1', status: 'PENDING' }], total: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { id: 'o1', status: 'PENDING' },
            { id: 'o2', status: 'PENDING' },
          ],
          total: 2,
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    await useAdminOrdersStore.getState().fetchBoard(params);
    useAdminOrdersStore.getState().applyRealtimeEvent({
      type: 'order_created',
      payload: { id: 'o2' },
    });
    await useAdminOrdersStore.getState().fetchBoard(params);
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(peekAdminQuery<{ total: number }>(adminOrdersBoardKey(params))?.data.total).toBe(2);
  });

  it('patches a visible order from a live event without treating it as a full reload', () => {
    useAdminSessionStore.getState().setEntry(adminOrdersBoardKey(params), {
      items: [
        {
          id: 'o1',
          orderNumber: 'GB1',
          status: 'PENDING',
          grandTotal: 10,
          priority: 'NORMAL',
          paymentMethod: 'COD',
          assignedStaffId: null,
          assignedStaff: null,
          lockedAt: null,
          adminNotes: null,
          createdAt: '2026-01-01',
          customer: {
            firstName: 'A',
            lastName: 'B',
            mobile: '9000000000',
            houseNumber: '1',
            street: 'St',
            area: 'Area',
            city: 'City',
            state: 'State',
            pincode: '000000',
          },
          items: [],
        },
      ],
      total: 1,
    });

    useAdminOrdersStore.getState().applyRealtimeEvent({
      type: 'order_updated',
      payload: { id: 'o1', status: 'PACKED' },
    });

    const board = peekAdminQuery<{ items: Array<{ status: string }> }>(adminOrdersBoardKey(params));
    expect(board?.data.items[0].status).toBe('PACKED');
    expect(board?.dirty).toBe(false);
  });

  it('maps live payload fields onto an order row', () => {
    const patched = patchOrderFromEvent(
      {
        id: 'o1',
        orderNumber: 'GB1',
        status: 'PENDING',
        grandTotal: 10,
        priority: 'NORMAL',
        paymentMethod: 'COD',
        assignedStaffId: null,
        assignedStaff: null,
        lockedAt: null,
        adminNotes: null,
        createdAt: '2026-01-01',
        customer: {
          firstName: 'A',
          lastName: 'B',
          mobile: '9000000000',
          houseNumber: '1',
          street: 'St',
          area: 'Area',
          city: 'City',
          state: 'State',
          pincode: '000000',
        },
        items: [],
      },
      { status: 'ACCEPTED', grandTotal: 12 },
    );
    expect(patched.status).toBe('ACCEPTED');
    expect(patched.grandTotal).toBe(12);
  });
});
