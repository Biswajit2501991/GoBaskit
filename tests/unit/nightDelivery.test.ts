import {
  nightDeliveryCopy,
  nightDeliveryWindow,
  parseOvernightCheckout,
  DEFAULT_OVERNIGHT_CHECKOUT,
} from '@/lib/nightDelivery';

describe('night delivery windows (IST)', () => {
  it('defaults to enabled when no settings row exists', () => {
    expect(parseOvernightCheckout(undefined)).toEqual(DEFAULT_OVERNIGHT_CHECKOUT);
    expect(parseOvernightCheckout({})).toMatchObject({ enabled: true });
  });

  it('treats 9:00 PM IST as tomorrow delivery', () => {
    // 21:00 IST = 15:30 UTC
    expect(nightDeliveryWindow(new Date('2026-09-07T15:30:00.000Z'))).toBe('tomorrow');
    expect(nightDeliveryWindow(new Date('2026-09-07T18:29:00.000Z'))).toBe('tomorrow');
    expect(nightDeliveryCopy('tomorrow')?.title).toMatch(/tomorrow/i);
  });

  it('treats midnight to 7:29 AM IST as after 8 AM today', () => {
    // 00:00 IST = 18:30 UTC previous calendar day
    expect(nightDeliveryWindow(new Date('2026-09-07T18:30:00.000Z'))).toBe('after_eight_today');
    // 7:29 AM IST = 01:59 UTC
    expect(nightDeliveryWindow(new Date('2026-09-07T01:59:00.000Z'))).toBe('after_eight_today');
    expect(nightDeliveryCopy('after_eight_today')?.title).toMatch(/8 AM today/i);
  });

  it('does not prompt at 7:30 AM or during the day', () => {
    // 7:30 AM IST = 02:00 UTC
    expect(nightDeliveryWindow(new Date('2026-09-07T02:00:00.000Z'))).toBe('none');
    // 3:00 PM IST = 09:30 UTC
    expect(nightDeliveryWindow(new Date('2026-09-07T09:30:00.000Z'))).toBe('none');
    expect(nightDeliveryCopy('none')).toBeNull();
  });

  it('skips the prompt when the feature switch is off', () => {
    const off = parseOvernightCheckout({ enabled: false });
    expect(off.enabled).toBe(false);
    expect(nightDeliveryWindow(new Date('2026-09-07T15:30:00.000Z'), off)).toBe('none');
    expect(nightDeliveryWindow(new Date('2026-09-07T18:30:00.000Z'), off)).toBe('none');
  });

  it('uses custom timings from store settings', () => {
    const custom = parseOvernightCheckout({
      enabled: true,
      eveningStart: '20:00',
      morningCutoff: '08:00',
      morningDeliveryFrom: '09:00',
    });
    // 8:00 PM IST = 14:30 UTC → tomorrow
    expect(nightDeliveryWindow(new Date('2026-09-07T14:30:00.000Z'), custom)).toBe('tomorrow');
    // 7:59 PM IST = 14:29 UTC → daytime, no prompt
    expect(nightDeliveryWindow(new Date('2026-09-07T14:29:00.000Z'), custom)).toBe('none');
    // 7:59 AM IST = 02:29 UTC → after morningDeliveryFrom today
    expect(nightDeliveryWindow(new Date('2026-09-07T02:29:00.000Z'), custom)).toBe(
      'after_eight_today',
    );
    // 8:00 AM IST = 02:30 UTC → prompt ends
    expect(nightDeliveryWindow(new Date('2026-09-07T02:30:00.000Z'), custom)).toBe('none');
    expect(nightDeliveryCopy('after_eight_today', custom)?.title).toMatch(/9 AM today/i);
  });

  it('keeps default windows when saved times would not wrap overnight', () => {
    const parsed = parseOvernightCheckout({
      enabled: true,
      eveningStart: '07:00',
      morningCutoff: '08:00',
    });
    expect(parsed.eveningStart).toBe(DEFAULT_OVERNIGHT_CHECKOUT.eveningStart);
    expect(parsed.morningCutoff).toBe(DEFAULT_OVERNIGHT_CHECKOUT.morningCutoff);
    expect(parsed.enabled).toBe(true);
  });
});
