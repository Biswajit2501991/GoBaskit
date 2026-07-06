export const BULK_CANCEL_CUSTOMER_MESSAGE =
  'Your order has been cancelled due to unavailability or product quality.';

export const CUSTOMER_ORDER_VISIBLE_HOURS = 24;
export const ORDER_ARCHIVE_RETENTION_HOURS = 72;

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
