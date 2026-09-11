import { parseJsonRequestBody } from '@/lib/parseJsonRequestBody';

function fakeReq(body: string, contentType?: string): Request {
  return {
    text: async () => body,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType ?? null : null),
    },
  } as unknown as Request;
}

describe('parseJsonRequestBody', () => {
  it('parses JSON even when Content-Type is text/plain (sendBeacon)', async () => {
    await expect(
      parseJsonRequestBody(
        fakeReq('{"mobile":"+919876543210","verificationId":"v1"}', 'text/plain;charset=UTF-8'),
      ),
    ).resolves.toEqual({
      mobile: '+919876543210',
      verificationId: 'v1',
    });
  });

  it('returns null for empty or invalid JSON', async () => {
    await expect(parseJsonRequestBody(fakeReq('  '))).resolves.toBeNull();
    await expect(
      parseJsonRequestBody(fakeReq('not-json', 'application/json')),
    ).resolves.toBeNull();
  });

  it('parses urlencoded bodies used by some beacons', async () => {
    await expect(
      parseJsonRequestBody(
        fakeReq('mobile=%2B919876543210&verificationId=v1', 'application/x-www-form-urlencoded'),
      ),
    ).resolves.toEqual({
      mobile: '+919876543210',
      verificationId: 'v1',
    });
  });
});
