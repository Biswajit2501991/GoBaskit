import {
  deliveredPushPayload,
  outForDeliveryPushPayload,
  shouldNotifyDelivered,
  shouldNotifyOutForDelivery,
} from '@/lib/customerOutForDeliveryPush';

describe('out-for-delivery customer push', () => {
  it('sends only when status first becomes OUT_FOR_DELIVERY', () => {
    expect(shouldNotifyOutForDelivery('PACKED', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(shouldNotifyOutForDelivery('OUT_FOR_DELIVERY', 'OUT_FOR_DELIVERY')).toBe(false);
    expect(shouldNotifyOutForDelivery('PACKED', 'DELIVERED')).toBe(false);
    expect(shouldNotifyOutForDelivery('PENDING', 'PACKED')).toBe(false);
  });

  it('includes the delivery PIN and no staff details', () => {
    const payload = outForDeliveryPushPayload({
      id: 'clorder1',
      orderNumber: 'GB12345678',
      deliveryPin: '4821',
    });
    expect(payload.title).toBe('GoBaskit');
    expect(payload.body).toBe(
      'Your order GB12345678 is out for delivery. Delivery PIN: 4821. Tell this to the rider.',
    );
    expect(payload.body.toLowerCase()).not.toMatch(/staff|rider name|assigned/);
    expect(payload.url).toBe('/account/track/clorder1');
    expect(payload.tag).toBe('ofd-clorder1');
  });

  it('omits an invalid PIN from the notification body', () => {
    const payload = outForDeliveryPushPayload({
      id: 'clorder1',
      orderNumber: 'GB12345678',
      deliveryPin: '12',
    });
    expect(payload.body).toBe('Your order GB12345678 is out for delivery by our partner.');
  });
});

describe('delivered customer push', () => {
  it('sends only when status first becomes DELIVERED', () => {
    expect(shouldNotifyDelivered('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
    expect(shouldNotifyDelivered('DELIVERED', 'DELIVERED')).toBe(false);
    expect(shouldNotifyDelivered('PACKED', 'OUT_FOR_DELIVERY')).toBe(false);
  });

  it('replaces the OFD notification and does not include the PIN', () => {
    const payload = deliveredPushPayload({ id: 'clorder1', orderNumber: 'GB12345678' });
    expect(payload.tag).toBe('ofd-clorder1');
    expect(payload.body).toBe('Your order GB12345678 has been delivered. Thank you!');
    expect(payload.body).not.toMatch(/PIN/);
    expect(payload.url).toBe('/account/track/clorder1');
  });
});
