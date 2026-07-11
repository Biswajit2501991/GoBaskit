import { createHmac } from 'crypto';
import {
  extractInboundTextMessages,
  verifyWhatsAppSignature,
} from '@/lib/whatsapp-cloud';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';

describe('WhatsAppVerificationService code extraction', () => {
  it('extracts GB-###### codes', () => {
    expect(
      WhatsAppVerificationService.extractVerificationCode(
        'Hi Go Baskit,\n\nPlease verify my WhatsApp.\n\nVerification Code:\nGB-123456\n',
      ),
    ).toBe('GB-123456');
  });

  it('accepts GB without hyphen', () => {
    expect(WhatsAppVerificationService.extractVerificationCode('code GB123456 please')).toBe(
      'GB-123456',
    );
  });

  it('returns null when missing', () => {
    expect(WhatsAppVerificationService.extractVerificationCode('hello')).toBeNull();
  });

  it('normalizes Meta from digits to E.164', () => {
    expect(WhatsAppVerificationService.normalizeInboundWaPhone('919876543210')).toBe(
      '+919876543210',
    );
  });
});

describe('whatsapp-cloud helpers', () => {
  const prevSecret = process.env.WHATSAPP_APP_SECRET;

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = prevSecret;
  });

  it('extracts inbound text messages', () => {
    const msgs = extractInboundTextMessages({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.1',
                    type: 'text',
                    text: { body: 'GB-999999' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(msgs).toEqual([
      { from: '919876543210', id: 'wamid.1', body: 'GB-999999' },
    ]);
  });

  it('verifies X-Hub-Signature-256', () => {
    const secret = 'test-secret';
    const body = '{"ok":true}';
    const digest = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    process.env.WHATSAPP_APP_SECRET = secret;
    expect(verifyWhatsAppSignature(body, `sha256=${digest}`)).toBe(true);
    expect(verifyWhatsAppSignature(body, 'sha256=deadbeef')).toBe(false);
  });
});
