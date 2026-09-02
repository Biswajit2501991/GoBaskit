import { outForDeliveryPushPayload, shouldNotifyOutForDelivery } from '@/lib/customerOutForDeliveryPush';

describe('out-for-delivery customer push', () => {
  it('sends only when status first becomes OUT_FOR_DELIVERY', () => {
    expect(shouldNotifyOutForDelivery('PACKED', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(shouldNotifyOutForDelivery('OUT_FOR_DELIVERY', 'OUT_FOR_DELIVERY')).toBe(false);
    expect(shouldNotifyOutForDelivery('PACKED', 'DELIVERED')).toBe(false);
    expect(shouldNotifyOutForDelivery('PENDING', 'PACKED')).toBe(false);
  });

  it('uses the public order number and no staff details', () => {
    const payload = outForDeliveryPushPayload({ id: 'clorder1', orderNumber: 'GB12345678' });
    expect(payload.title).toBe('GoBaskit');
    expect(payload.body).toBe('Your order GB12345678 is out for delivery by our partner.');
    expect(payload.body.toLowerCase()).not.toMatch(/staff|rider|assigned|partner name/);
    expect(payload.url).toBe('/account/track/clorder1');
    expect(payload.tag).toBe('ofd-clorder1');
  });
});
