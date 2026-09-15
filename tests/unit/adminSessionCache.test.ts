import { ensureAdminQuery, peekAdminQuery, useAdminSessionStore } from '@/store/adminSessionCache';

describe('adminSessionCache', () => {
  beforeEach(() => {
    useAdminSessionStore.getState().invalidate();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips a second fetch while the snapshot is fresh', async () => {
    const loader = jest.fn().mockResolvedValue({ ok: 1 });
    await ensureAdminQuery('demo', loader);
    await ensureAdminQuery('demo', loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(peekAdminQuery<{ ok: number }>('demo')?.data.ok).toBe(1);
  });

  it('refetches in the background after markDirty', async () => {
    const loader = jest
      .fn()
      .mockResolvedValueOnce({ n: 1 })
      .mockResolvedValueOnce({ n: 2 });
    await ensureAdminQuery('demo', loader);
    useAdminSessionStore.getState().markDirty('demo');
    await ensureAdminQuery('demo', loader);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(loader).toHaveBeenCalledTimes(2);
    expect(peekAdminQuery<{ n: number }>('demo')?.data.n).toBe(2);
  });
});
