import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';
import {
  extractInboundTextMessages,
  getWhatsAppVerifyToken,
  isWhatsAppWebhookConfigured,
  sendWhatsAppTextReply,
  verifyWhatsAppSignature,
} from '@/lib/whatsapp-cloud';

export const runtime = 'nodejs';

/**
 * Meta WhatsApp Cloud API webhook.
 * GET  — subscription challenge
 * POST — inbound messages → auto-approve matching GB-###### + sender mobile
 *
 * Configure in Meta Developer:
 *   Callback URL: https://gobaskitkaro.com/api/webhooks/whatsapp
 *   Verify token: WHATSAPP_VERIFY_TOKEN
 *   Subscribe: messages
 */
export async function GET(req: NextRequest) {
  const verifyToken = getWhatsAppVerifyToken();
  if (!verifyToken) {
    return NextResponse.json({ error: 'WhatsApp webhook not configured' }, { status: 503 });
  }

  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  if (!isWhatsAppWebhookConfigured()) {
    return NextResponse.json({ error: 'WhatsApp webhook not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  if (!verifyWhatsAppSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const messages = extractInboundTextMessages(payload);
  const results: Array<{ id: string; result: string }> = [];

  for (const msg of messages) {
    try {
      const result = await WhatsAppVerificationService.tryAutoApproveFromInbound({
        senderFrom: msg.from,
        messageBody: msg.body,
        waMessageId: msg.id,
      });
      results.push({ id: msg.id, result });

      if (result === 'approved' || result === 'already_verified') {
        void sendWhatsAppTextReply(
          msg.from,
          'GoBaskit: Your WhatsApp is verified. You can continue on the website.',
        );
      }
    } catch (err) {
      console.error('[whatsapp-webhook] auto-approve failed', msg.id, err);
      results.push({ id: msg.id, result: 'error' });
    }
  }

  // Meta expects 200 quickly; always acknowledge after signature check.
  return NextResponse.json({ ok: true, processed: results.length, results });
}
