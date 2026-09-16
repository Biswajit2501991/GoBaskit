import { buildCancelledOrderAlert } from '@/lib/orderCancelledNotify';

describe('buildCancelledOrderAlert', () => {
  it('names the customer on a customer cancel', () => {
    expect(
      buildCancelledOrderAlert({
        orderNumber: 'GB99',
        customerName: 'Rina Das',
        city: 'Adra',
        grandTotal: 180,
        by: 'customer',
      }),
    ).toEqual({
      type: 'order_cancelled',
      title: 'Cancelled · GB99',
      message: 'Rina Das cancelled this order.\n₹180 · Adra',
    });
  });

  it('names staff when they cancel from admin', () => {
    const alert = buildCancelledOrderAlert({
      orderNumber: 'GB99',
      customerName: 'Rina Das',
      city: 'Adra',
      grandTotal: 180,
      by: 'staff',
      staffName: 'Deep',
    });
    expect(alert.message.startsWith('Deep cancelled this order.')).toBe(true);
  });
});
