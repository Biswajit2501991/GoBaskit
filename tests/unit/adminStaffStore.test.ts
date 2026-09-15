import { adminStaffListKey, useAdminStaffStore } from '@/store/adminStaffStore';

describe('adminStaffStore', () => {
  beforeEach(() => {
    useAdminStaffStore.getState().invalidateStaff();
    useAdminStaffStore.getState().invalidateShops();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keys list pages by page size and search', () => {
    expect(adminStaffListKey({ page: 1 })).toBe(adminStaffListKey({ page: 1, search: '  ' }));
    expect(adminStaffListKey({ page: 1, search: 'ram' })).not.toBe(adminStaffListKey({ page: 2, search: 'ram' }));
  });

  it('does not refetch the same staff page while the cache is fresh', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: 's1', name: 'Ravi' }], total: 1 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const params = { page: 1, search: '' };
    await useAdminStaffStore.getState().fetchStaff(params);
    await useAdminStaffStore.getState().fetchStaff(params);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAdminStaffStore.getState().lists[adminStaffListKey(params)]?.total).toBe(1);
  });

  it('refetches after a mutation even when the cache is still fresh', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 's1', name: 'Ravi' }], total: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 's1', name: 'Ravi' }, { id: 's2', name: 'New' }], total: 2 }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const params = { page: 1, search: '' };
    await useAdminStaffStore.getState().fetchStaff(params);
    await useAdminStaffStore.getState().refreshStaff(params);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useAdminStaffStore.getState().lists[adminStaffListKey(params)]?.total).toBe(2);
  });
});
