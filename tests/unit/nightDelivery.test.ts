import { nightDeliveryCopy, nightDeliveryWindow } from '@/lib/nightDelivery';

describe('night delivery windows (IST)', () => {
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
});
