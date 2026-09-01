import { inboundSenderMatchesClaimed } from '@/lib/whatsappSenderMatch';

describe('inboundSenderMatchesClaimed', () => {
  it('treats E.164 and national India forms as the same number', () => {
    expect(inboundSenderMatchesClaimed('+919876543210', '+919876543210')).toBe(true);
    expect(inboundSenderMatchesClaimed('+919876543210', '9876543210')).toBe(true);
  });

  it('rejects a different WhatsApp sender', () => {
    expect(inboundSenderMatchesClaimed('+919999999999', '+919876543210')).toBe(false);
  });
});
