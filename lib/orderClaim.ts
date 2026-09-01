import type { OrderStatus } from '@prisma/client';

/** Moving off Pending to these stages claims the ticket. Cancel does not. */
export const CLAIM_FROM_PENDING_STATUSES: OrderStatus[] = [
  'ACCEPTED',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export function shouldClaimUnassignedPending(params: {
  currentStatus: OrderStatus;
  nextStatus?: OrderStatus | null;
  assignedStaffId?: string | null;
}): boolean {
  if (params.assignedStaffId) return false;
  if (params.currentStatus !== 'PENDING') return false;
  const next = params.nextStatus;
  if (!next || next === params.currentStatus) return false;
  return CLAIM_FROM_PENDING_STATUSES.includes(next);
}

export function shouldUnlockStaffLock(nextStatus?: OrderStatus | null): boolean {
  return nextStatus === 'DELIVERED' || nextStatus === 'CANCELLED';
}
