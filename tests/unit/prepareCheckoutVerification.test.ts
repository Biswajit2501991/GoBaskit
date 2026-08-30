import { prepareCheckoutVerification, clearPreparedCheckoutVerification } from '@/utils/prepareCheckoutVerification';

describe('prepareCheckoutVerification', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearPreparedCheckoutVerification();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearPreparedCheckoutVerification();
  });

  it('reuses one in-flight generate per mobile so Place Order does not create a second code', async () => {
    let resolveFetch: (value: Response) => void = () => {};
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const first = prepareCheckoutVerification('+919876543210');
    const second = prepareCheckoutVerification('+919876543210');
    expect(first).toBe(second);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch({
      ok: true,
      json: async () => ({
        verified: false,
        verification: {
          id: 'v1',
          mobile: '+919876543210',
          verificationCode: 'GB-111111',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          expiresAt: new Date().toISOString(),
          verifiedAt: null,
        },
        whatsappUrl: 'https://api.whatsapp.com/send?phone=1&text=x',
      }),
    } as Response);

    const result = await first;
    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.verification.id).toBe('v1');
    }
    await expect(second).resolves.toEqual(result);
  });

  it('does not cache a failed generate', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Maximum verification attempts reached for today. Please try again tomorrow.' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verified: true }),
      });

    await expect(prepareCheckoutVerification('+919876543210')).rejects.toThrow(/Maximum verification/);
    const retry = await prepareCheckoutVerification('+919876543210');
    expect(retry).toEqual({ verified: true, mobileE164: '+919876543210' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
