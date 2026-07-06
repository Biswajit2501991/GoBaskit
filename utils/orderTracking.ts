import type { OrderStatus } from '@prisma/client';

export const TRACKING_STEPS = [
  { id: 'received', label: 'Order Received', description: 'We have received your order' },
  { id: 'packaging', label: 'Order Packaging', description: 'Your items are being packed' },
  { id: 'out_for_delivery', label: 'Out for Delivery', description: 'Your order is on the way' },
  { id: 'delivered', label: 'Delivered', description: 'Item has been delivered' },
] as const;

const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY'];

export function isActiveOrderStatus(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isTrackableOrderStatus(status: OrderStatus): boolean {
  return status !== 'DELIVERED';
}

/** 0–3 = step index for progress bar; -1 = cancelled; 4 = delivered complete */
export function getTrackingStepIndex(status: OrderStatus): number {
  if (status === 'CANCELLED') return -1;
  if (status === 'PENDING' || status === 'ACCEPTED') return 0;
  if (status === 'PACKED') return 1;
  if (status === 'OUT_FOR_DELIVERY') return 2;
  if (status === 'DELIVERED') return 3;
  return 0;
}

export function getTrackingHeadline(status: OrderStatus): string {
  if (status === 'CANCELLED') return 'Order cancelled';
  if (status === 'DELIVERED') return 'Item has been delivered';
  if (status === 'OUT_FOR_DELIVERY') return 'Your order is out for delivery';
  if (status === 'PACKED') return 'Your order is being packaged';
  return 'Order received — we will start packing soon';
}
