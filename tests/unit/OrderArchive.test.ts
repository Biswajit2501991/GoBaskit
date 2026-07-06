import { BULK_CANCEL_CUSTOMER_MESSAGE, addHours, CUSTOMER_ORDER_VISIBLE_HOURS, ORDER_ARCHIVE_RETENTION_HOURS } from '@/constants/orderArchive';

describe('orderArchive constants', () => {
  it('has expected retention windows', () => {
    expect(CUSTOMER_ORDER_VISIBLE_HOURS).toBe(24);
    expect(ORDER_ARCHIVE_RETENTION_HOURS).toBe(72);
  });

  it('adds hours correctly', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = addHours(start, 24);
    expect(end.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('includes cancellation copy', () => {
    expect(BULK_CANCEL_CUSTOMER_MESSAGE).toMatch(/cancelled/i);
    expect(BULK_CANCEL_CUSTOMER_MESSAGE).toMatch(/unavailability|product quality/i);
  });
});
