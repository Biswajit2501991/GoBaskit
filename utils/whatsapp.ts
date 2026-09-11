import type { CartItem, CheckoutFormData } from '@/types';
import { formatCustomerName } from '@/utils/customer';
import { PAYMENT_METHODS } from '@/constants';
import { formatCurrency } from '@/utils/formatter';
import { formatCartLineName } from '@/utils/orderItemName';

interface WhatsAppOrderParams {
  items: CartItem[];
  customer: CheckoutFormData;
  subtotal: number;
  deliveryCharge: number;
  grandTotal: number;
  discountAmount?: number;
  discountLabel?: string;
  storeName?: string;
  orderNumber?: string;
  deliveryNote?: string;
  deliveryPin?: string;
}

export function buildWhatsAppMessage({
  items,
  customer,
  subtotal,
  deliveryCharge,
  grandTotal,
  discountAmount = 0,
  discountLabel,
  storeName = 'GoBaskit',
  orderNumber,
  deliveryNote,
  deliveryPin,
}: WhatsAppOrderParams): string {
  const lines: string[] = [
    `Hello ${storeName},`,
    '',
    'I would like to place the following order.',
    ...(orderNumber ? ['', `Order number: ${orderNumber}`] : []),
    ...(deliveryPin ? ['', `Delivery PIN: ${deliveryPin} (tell this to the rider)`] : []),
    ...(deliveryNote ? ['', deliveryNote] : []),
    '',
    'Customer',
    '',
    `Name: ${formatCustomerName(customer.firstName, customer.lastName)}`,
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
    const lineName = formatCartLineName(item);
    lines.push(`${index + 1}. ${lineName} x${item.quantity} = ${formatCurrency(lineTotal)}`);
  });

  lines.push(
    '',
    '-----------------------',
    '',
    `Subtotal: ${formatCurrency(subtotal)}`,
  );

  if (discountAmount > 0) {
    const label = discountLabel ? `Discount (${discountLabel})` : 'Discount';
    lines.push(`${label}: −${formatCurrency(discountAmount)}`);
  }

  lines.push(
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
  if (!cleanPhone) {
    throw new Error('WhatsApp phone number is missing');
  }
  const encoded = encodeURIComponent(message);
  // api.whatsapp.com is more reliable than wa.me (fewer SSL/proxy issues on mobile networks).
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
}

/** Opens WhatsApp in a new tab. Returns false if the popup was blocked and same-window is disallowed. */
export function openWhatsAppUrl(url: string, options?: { allowSameWindow?: boolean }): boolean {
  if (typeof window === 'undefined') return false;

  try {
    sessionStorage.setItem('gobaskit_last_whatsapp_url', url);
  } catch {
    /* private mode */
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    if (options?.allowSameWindow === false) return false;
    window.location.href = url;
  }
  return true;
}
