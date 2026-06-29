import type { CartItem, CheckoutFormData } from '@/types';
import { PAYMENT_METHODS } from '@/constants';
import { formatCurrency } from '@/utils/formatter';

interface WhatsAppOrderParams {
  items: CartItem[];
  customer: CheckoutFormData;
  subtotal: number;
  deliveryCharge: number;
  grandTotal: number;
  storeName?: string;
}

export function buildWhatsAppMessage({
  items,
  customer,
  subtotal,
  deliveryCharge,
  grandTotal,
  storeName = 'GoBaskit',
}: WhatsAppOrderParams): string {
  const lines: string[] = [
    `Hello ${storeName},`,
    '',
    'I would like to place the following order.',
    '',
    'Customer',
    '',
    `Name: ${customer.firstName} ${customer.lastName}`,
    `Phone: ${customer.mobile}`,
  ];

  if (customer.alternateMobile) {
    lines.push(`Alternate Phone: ${customer.alternateMobile}`);
  }

  lines.push(
    '',
    'Address:',
    customer.houseNumber,
    customer.street,
    customer.area,
    customer.landmark ? `Landmark: ${customer.landmark}` : '',
    `${customer.city}, ${customer.state}`,
    `PIN: ${customer.pincode}`,
  );

  if (customer.deliveryNotes) {
    lines.push(`Delivery Notes: ${customer.deliveryNotes}`);
  }

  lines.push('', 'Items', '');

  items.forEach((item, index) => {
    const lineTotal = item.price * item.quantity;
    lines.push(`${index + 1}. ${item.name} x${item.quantity} = ${formatCurrency(lineTotal)}`);
  });

  lines.push(
    '',
    '-----------------------',
    '',
    `Subtotal: ${formatCurrency(subtotal)}`,
    `Delivery: ${formatCurrency(deliveryCharge)}`,
    `Grand Total: ${formatCurrency(grandTotal)}`,
    '',
    'Payment Method',
    '',
    PAYMENT_METHODS[customer.paymentMethod],
    '',
    'Thank You',
  );

  return lines.filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
}

export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}
