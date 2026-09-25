import { isAcceptingOrders } from '@/lib/acceptingOrders';
import { CHECKOUT_CODES } from '@/lib/checkoutOrder';

describe('accepting orders gate', () => {
  it('treats missing and true as open so checkout stays unchanged by default', () => {
    expect(isAcceptingOrders(undefined)).toBe(true);
    expect(isAcceptingOrders(true)).toBe(true);
    expect(isAcceptingOrders(false)).toBe(false);
  });

  it('exposes a checkout error code for paused orders', () => {
    expect(CHECKOUT_CODES.ORDERS_PAUSED).toBe('ORDERS_PAUSED');
  });
});
