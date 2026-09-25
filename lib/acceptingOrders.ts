export const ORDERS_PAUSED_MESSAGE =
  'We are not taking orders right now. Please try again later.';

/** Missing or any value other than false means the store is taking orders. */
export function isAcceptingOrders(value: unknown): boolean {
  return value !== false;
}
