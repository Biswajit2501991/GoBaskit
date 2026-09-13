import { ADMIN_PUSH_TTL_SECONDS } from '@/services/AdminPushService';
import { isAndroidBrowser, isAppleMobileBrowser } from '@/lib/admin-push-client';
import { sanitizeVapidValue } from '@/lib/vapid';

describe('admin push', () => {
  it('keeps FCM messages long enough for Android Doze delay', () => {
    expect(ADMIN_PUSH_TTL_SECONDS).toBeGreaterThanOrEqual(24 * 60 * 60);
  });

  it('detects Android Chrome user agents', () => {
    expect(
      isAndroidBrowser(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe(true);
    expect(
      isAndroidBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(false);
  });

  it('does not treat an explicit Android UA as Apple', () => {
    expect(
      isAppleMobileBrowser(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe(false);
  });

  it('treats iPad Safari as Apple even when the UA looks like a Mac', () => {
    expect(
      isAppleMobileBrowser(
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true);
  });

  it('treats iPadOS Macintosh UA as Apple when the device reports a touch screen', () => {
    const nav = globalThis.navigator as Navigator & { maxTouchPoints: number };
    const previous = nav.maxTouchPoints;
    Object.defineProperty(nav, 'maxTouchPoints', { configurable: true, value: 5 });
    try {
      expect(
        isAppleMobileBrowser(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        ),
      ).toBe(true);
    } finally {
      Object.defineProperty(nav, 'maxTouchPoints', { configurable: true, value: previous });
    }
  });

  it('strips wrapping quotes and whitespace from VAPID secrets', () => {
    expect(sanitizeVapidValue('"BNpublic"')).toBe('BNpublic');
    expect(sanitizeVapidValue("'BNpublic'")).toBe('BNpublic');
    expect(sanitizeVapidValue(' BN public \n')).toBe('BNpublic');
    expect(sanitizeVapidValue('""')).toBeNull();
    expect(sanitizeVapidValue(undefined)).toBeNull();
  });
});
