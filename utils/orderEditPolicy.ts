import type { OrderStatus } from '@prisma/client';

/** Customer may change items, address, or cancel within this window after `createdAt`. */
export const CUSTOMER_ORDER_EDIT_WINDOW_MS = 10 * 60 * 1000;

export type OrderEditSnapshot = {
  status: OrderStatus;
  createdAt: Date;
  archivedAt?: Date | null;
};

export function customerEditExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + CUSTOMER_ORDER_EDIT_WINDOW_MS);
}

/** Staff and customers may change line items / address only before packing. */
export function isItemEditableStatus(status: OrderStatus): boolean {
  return status === 'PENDING' || status === 'ACCEPTED';
}

export function canStaffMutateItems(order: OrderEditSnapshot): boolean {
  if (order.archivedAt) return false;
  return isItemEditableStatus(order.status);
}

export function canCustomerMutate(order: OrderEditSnapshot, now: Date = new Date()): boolean {
  if (order.archivedAt) return false;
  if (!isItemEditableStatus(order.status)) return false;
  return now.getTime() < customerEditExpiresAt(order.createdAt).getTime();
}

export function customerEditDenialMessage(order: OrderEditSnapshot, now: Date = new Date()): string {
  if (order.archivedAt) return 'This order is no longer available.';
  if (order.status === 'CANCELLED') return 'This order is cancelled and cannot be changed.';
  if (order.status === 'DELIVERED') return 'This order is delivered and cannot be changed.';
  if (!isItemEditableStatus(order.status)) {
    return 'This order is being prepared for delivery and can no longer be changed.';
  }
  if (now.getTime() >= customerEditExpiresAt(order.createdAt).getTime()) {
    return 'The 10-minute edit window has ended. This order is locked.';
  }
  return 'This order cannot be changed.';
}

export function staffItemEditDenialMessage(order: OrderEditSnapshot): string {
  if (order.archivedAt) return 'Archived orders cannot be edited.';
  if (!isItemEditableStatus(order.status)) {
    return 'Items and address are locked after the order is packed.';
  }
  return 'This order cannot be edited.';
}
