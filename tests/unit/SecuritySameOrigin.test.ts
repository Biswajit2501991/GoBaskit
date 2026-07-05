import { requireSameOrigin } from '@/lib/security';

function mockReq(method: string, headers: Record<string, string> = {}) {
  const lowered = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    method,
    headers: {
      get: (key: string) => lowered[key.toLowerCase()] || null,
    },
  } as unknown as Request;
}

describe('requireSameOrigin', () => {
  const prevNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
  });

  it('allows safe GET requests', () => {
    const req = mockReq('GET');
    expect(requireSameOrigin(req)).toBeNull();
  });

  it('blocks missing origin in production', async () => {
    process.env.NODE_ENV = 'production';
    const req = mockReq('PATCH', {
      host: 'www.gobaskitkaro.com',
      'x-forwarded-proto': 'https',
    });
    expect(requireSameOrigin(req)).toBe('Missing origin header');
  });

  it('allows same-origin mutation requests', () => {
    process.env.NODE_ENV = 'production';
    const req = mockReq('PATCH', {
      host: 'www.gobaskitkaro.com',
      origin: 'https://www.gobaskitkaro.com',
      'x-forwarded-proto': 'https',
    });
    expect(requireSameOrigin(req)).toBeNull();
  });
});
