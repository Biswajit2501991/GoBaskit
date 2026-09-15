import {
  clampIdleTimeoutMinutes,
  DEFAULT_STAFF_IDLE_TIMEOUT_MINUTES,
  isStaffIdleExpired,
  MAX_STAFF_IDLE_TIMEOUT_MINUTES,
  MIN_STAFF_IDLE_TIMEOUT_MINUTES,
} from '@/lib/staffIdle';

describe('staff idle timeout', () => {
  it('defaults to 6 hours and clamps the allowed range', () => {
    expect(DEFAULT_STAFF_IDLE_TIMEOUT_MINUTES).toBe(360);
    expect(clampIdleTimeoutMinutes(undefined)).toBe(360);
    expect(clampIdleTimeoutMinutes(1)).toBe(MIN_STAFF_IDLE_TIMEOUT_MINUTES);
    expect(clampIdleTimeoutMinutes(9999)).toBe(MAX_STAFF_IDLE_TIMEOUT_MINUTES);
    expect(clampIdleTimeoutMinutes(360)).toBe(360);
  });

  it('treats activity as a sliding window', () => {
    const lastActiveAt = new Date('2026-09-15T00:00:00.000Z');
    const almostSixHours = Date.parse('2026-09-15T05:59:00.000Z');
    const sixHours = Date.parse('2026-09-15T06:00:00.000Z');

    expect(
      isStaffIdleExpired(lastActiveAt, { enabled: true, minutes: 360 }, almostSixHours),
    ).toBe(false);
    expect(
      isStaffIdleExpired(lastActiveAt, { enabled: true, minutes: 360 }, sixHours),
    ).toBe(true);
  });

  it('does not expire when idle logout is disabled or activity was never recorded', () => {
    expect(
      isStaffIdleExpired(new Date(), { enabled: false, minutes: 360 }, Date.now()),
    ).toBe(false);
    expect(isStaffIdleExpired(null, { enabled: true, minutes: 360 }, Date.now())).toBe(false);
  });
});
