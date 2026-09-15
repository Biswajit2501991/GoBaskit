import type { OrderStatus } from '@prisma/client';

export function shouldNotifyOutForDelivery(
  previousStatus: OrderStatus,
  nextStatus: OrderStatus | undefined,
): boolean {
  return nextStatus === 'OUT_FOR_DELIVERY' && previousStatus !== 'OUT_FOR_DELIVERY';
}

/** System notification copy — never include staff or rider names. */
export function outForDeliveryPushPayload(order: {
  id: string;
  orderNumber: string;
  deliveryPin?: string | null;
}) {
  const pin = typeof order.deliveryPin === 'string' && /^\d{4}$/.test(order.deliveryPin) ? order.deliveryPin : '';
  return {
    title: 'GoBaskit',
    body: pin
      ? `Your order ${order.orderNumber} is out for delivery. Delivery PIN: ${pin}. Tell this to the rider.`
      : `Your order ${order.orderNumber} is out for delivery by our partner.`,
    url: `/account/track/${order.id}`,
    tag: `ofd-${order.id}`,
  };
}

export function shouldNotifyDelivered(
  previousStatus: OrderStatus,
  nextStatus: OrderStatus | undefined,
): boolean {
  return nextStatus === 'DELIVERED' && previousStatus !== 'DELIVERED';
}

/** Same tag as OFD so Android/Chrome replaces the PIN notification. */
export function deliveredPushPayload(order: { id: string; orderNumber: string }) {
  return {
    title: 'GoBaskit',
    body: `Your order ${order.orderNumber} has been delivered. Thank you!`,
    url: `/account/track/${order.id}`,
    tag: `ofd-${order.id}`,
  };
}
