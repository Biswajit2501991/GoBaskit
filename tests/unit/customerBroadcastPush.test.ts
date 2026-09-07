import { customerBroadcastPayload, sanitizeBroadcastText } from '@/lib/customerBroadcastPush';

describe('customer store broadcast copy', () => {
  it('keeps a plain title and message and opens the shop', () => {
    const payload = customerBroadcastPayload({
      title: 'New items in stock',
      message: 'We have added more items to our list.',
    });
    expect(payload.title).toBe('New items in stock');
    expect(payload.body).toBe('We have added more items to our list.');
    expect(payload.url).toBe('/');
    expect(payload.tag).toBe('gobaskit-store-broadcast');
  });

  it('strips tags and extra space without changing stored settings', () => {
    expect(sanitizeBroadcastText('  We have <b>added</b> more items  ', 80)).toBe(
      'We have added more items',
    );
    expect(customerBroadcastPayload({ title: '   ', message: 'Hello' }).title).toBe('');
  });
});
