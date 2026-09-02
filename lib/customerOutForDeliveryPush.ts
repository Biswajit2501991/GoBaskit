import type { OrderStatus } from '@prisma/client';

export function shouldNotifyOutForDelivery(
  previousStatus: OrderStatus,
  nextStatus: OrderStatus | undefined,
): boolean {
  return nextStatus === 'OUT_FOR_DELIVERY' && previousStatus !== 'OUT_FOR_DELIVERY';
}

/** System notification copy — never include staff or rider names. */
export function outForDeliveryPushPayload(order: { id: string; orderNumber: string }) {
  return {
    title: 'GoBaskit',
    body: `Your order ${order.orderNumber} is out for delivery by our partner.`,
    url: `/account/track/${order.id}`,
    tag: `ofd-${order.id}`,
  };
}
