import { ADMIN_PUSH_TTL_SECONDS } from '@/services/AdminPushService';
import { isAndroidBrowser, isAppleMobileBrowser } from '@/lib/admin-push-client';

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
});
