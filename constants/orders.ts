import type { OrderStatus } from '@prisma/client';

/** Orders still in the fulfillment pipeline (shown on Live ops strip). */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PACKED',
  'OUT_FOR_DELIVERY',
];

/** Safety-net push while an order stays unassigned. */
export const UNASSIGNED_PUSH_REMINDER_MAX = 3;
export const UNASSIGNED_PUSH_REMINDER_INTERVAL_MS = 10 * 60 * 1000;
/** Ignore stale unassigned orders (avoid a one-time blast of old tickets). */
export const UNASSIGNED_PUSH_REMINDER_LOOKBACK_MS = 48 * 60 * 60 * 1000;
