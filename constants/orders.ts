import type { OrderStatus } from '@prisma/client';

/** Orders still in the fulfillment pipeline (shown on Live ops strip). */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PACKED',
  'OUT_FOR_DELIVERY',
];
