import type { OrderStatus } from '@prisma/client';

/** Orders still in the fulfillment pipeline (shown on Live ops strip). */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PACKED',
  'OUT_FOR_DELIVERY',
];

/** Repeat push while an order stays Pending and unassigned (until Accept or this lookback). */
export const UNASSIGNED_PUSH_REMINDER_INTERVAL_MS = 15 * 60 * 1000;
/** Ignore stale unassigned orders (avoid a one-time blast of old tickets). */
export const UNASSIGNED_PUSH_REMINDER_LOOKBACK_MS = 48 * 60 * 60 * 1000;
