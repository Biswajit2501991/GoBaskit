export function buildCancelledOrderAlert(params: {
  orderNumber: string;
  customerName: string;
  city: string;
  grandTotal: number;
  by: 'customer' | 'staff';
  staffName?: string;
}) {
  const title = `Cancelled · ${params.orderNumber}`;
  const who =
    params.by === 'customer'
      ? `${params.customerName} cancelled this order.`
      : `${(params.staffName || 'Staff').trim()} cancelled this order.`;
  const city = params.city.trim();
  const message = [who, city ? `₹${params.grandTotal} · ${city}` : `₹${params.grandTotal}`].join('\n');
  return { title, message, type: 'order_cancelled' as const };
}
