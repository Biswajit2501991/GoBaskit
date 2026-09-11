import { notifyWhatsAppOpened } from '@/utils/notifyWhatsAppOpened';

describe('notifyWhatsAppOpened', () => {
  const payload = { mobile: '+919876543210', verificationId: 'v-open' };

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns verified when the opened request succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ verified: true }),
    }) as unknown as typeof fetch;
    const beacon = jest.fn();
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });

    await expect(notifyWhatsAppOpened(payload)).resolves.toEqual({ verified: true });
    expect(beacon).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      '/api/customer/verification/opened',
      expect.objectContaining({ method: 'POST', keepalive: true }),
    );
  });

  it('sends a beacon when the opened request is still in flight', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockReturnValue(new Promise(() => undefined)) as unknown as typeof fetch;
    const beacon = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });

    const pending = notifyWhatsAppOpened(payload);
    await jest.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toEqual({ verified: false });
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/customer/verification/opened',
      expect.objectContaining({ keepalive: true }),
    );
  });
});
