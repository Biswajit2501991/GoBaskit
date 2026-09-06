import {
  amountsClose,
  generateOrderNumber,
  isIdempotencyKeyConflict,
  parseIdempotencyKey,
  stockOrUnavailableCode,
} from '@/lib/checkoutOrder';

describe('checkout order helpers', () => {
  it('accepts UUID v4 idempotency keys only', () => {
    expect(parseIdempotencyKey('not-a-key')).toBeNull();
    expect(parseIdempotencyKey('  550e8400-e29b-41d4-a716-446655440000  ')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('generates unique GB order numbers', () => {
    const a = generateOrderNumber();
    const b = generateOrderNumber();
    expect(a.startsWith('GB')).toBe(true);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(10);
  });

  it('treats totals within 50 paise as the same quote', () => {
    expect(amountsClose(199.2, 199.4)).toBe(true);
    expect(amountsClose(199, 200)).toBe(false);
  });

  it('maps stock copy to STOCK and delivery copy to UNAVAILABLE', () => {
    expect(stockOrUnavailableCode('Only 2 units of Milk left in stock.')).toBe('STOCK');
    expect(stockOrUnavailableCode('Sorry, delivery is currently unavailable in your area.')).toBe(
      'UNAVAILABLE',
    );
  });

  it('detects idempotency unique conflicts', () => {
    expect(
      isIdempotencyKeyConflict({
        meta: { target: ['idempotency_key'] },
      }),
    ).toBe(true);
    expect(isIdempotencyKeyConflict({ meta: { target: 'order_number' } })).toBe(false);
  });
});
