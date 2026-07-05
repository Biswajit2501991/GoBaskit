import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/utils/whatsapp';
import type { CartItem, CheckoutFormData } from '@/types';

describe('WhatsApp Message Generation', () => {
  const items: CartItem[] = [
    { productId: '1', name: 'Tomato', price: 45, unit: 'kg', quantity: 2, stock: 10 },
    { productId: '2', name: 'Potato', price: 40, unit: 'kg', quantity: 3, stock: 10 },
    { productId: '3', name: 'Milk', price: 60, unit: '500ml', quantity: 2, stock: 10 },
  ];

  const customer: CheckoutFormData = {
    firstName: 'John',
    lastName: 'Smith',
    mobile: '9876543210',
    houseNumber: 'House 25',
    street: 'ABC Street',
    area: 'Melbourne',
    city: 'Melbourne',
    state: 'Victoria',
    pincode: '300000',
    paymentMethod: 'COD',
  };

  it('generates message with all items and totals', () => {
    const message = buildWhatsAppMessage({
      items,
      customer,
      subtotal: 330,
      deliveryCharge: 30,
      grandTotal: 360,
    });

    expect(message).toContain('John Smith');
    expect(message).toContain('9876543210');
    expect(message).toContain('Tomato x2');
    expect(message).toContain('Grand Total');
    expect(message).toContain('Cash On Delivery');
  });

  it('regenerates when quantity changes', () => {
    const updatedItems = items.map((i) => (i.productId === '1' ? { ...i, quantity: 5 } : i));
    const message = buildWhatsAppMessage({
      items: updatedItems,
      customer,
      subtotal: 465,
      deliveryCharge: 30,
      grandTotal: 495,
    });
    expect(message).toContain('Tomato x5');
    expect(message).not.toContain('Tomato x2');
  });

  it('builds valid WhatsApp URL', () => {
    const url = buildWhatsAppUrl('917899813212', 'Hello Test');
    expect(url).toContain('api.whatsapp.com/send');
    expect(url).toContain('phone=917899813212');
    expect(url).toContain('text=');
  });
});
