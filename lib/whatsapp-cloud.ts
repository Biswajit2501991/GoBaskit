import { createHmac, timingSafeEqual } from 'crypto';

export function isWhatsAppWebhookConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_VERIFY_TOKEN?.trim() && process.env.WHATSAPP_APP_SECRET?.trim(),
  );
}

export function getWhatsAppVerifyToken(): string | null {
  return process.env.WHATSAPP_VERIFY_TOKEN?.trim() || null;
}

export function getWhatsAppAppSecret(): string | null {
  return process.env.WHATSAPP_APP_SECRET?.trim() || null;
}

/** Validate Meta X-Hub-Signature-256 against raw body. */
export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = getWhatsAppAppSecret();
  if (!secret || !signatureHeader) return false;

  const expected = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader;

  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  try {
    const a = Buffer.from(digest, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface InboundWhatsAppTextMessage {
  from: string;
  id: string;
  body: string;
}

/** Pull text messages from a Meta Cloud API webhook payload. */
export function extractInboundTextMessages(payload: unknown): InboundWhatsAppTextMessage[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as {
    object?: string;
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: {
          messages?: Array<{
            from?: string;
            id?: string;
            type?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  };

  if (root.object !== 'whatsapp_business_account' || !Array.isArray(root.entry)) {
    return [];
  }

  const out: InboundWhatsAppTextMessage[] = [];
  for (const entry of root.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field && change.field !== 'messages') continue;
      for (const msg of change.value?.messages ?? []) {
        if (msg.type && msg.type !== 'text') continue;
        const from = msg.from?.trim();
        const id = msg.id?.trim();
        const body = msg.text?.body?.trim();
        if (from && id && body) {
          out.push({ from, id, body });
        }
      }
    }
  }
  return out;
}

/** Optional ack reply via Cloud API (no-op if tokens missing). */
export async function sendWhatsAppTextReply(toDigits: string, text: string): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return false;

  const to = toDigits.replace(/\D/g, '');
  if (!to) return false;

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
