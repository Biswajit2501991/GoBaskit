import { normalizeMobile } from '@/utils/mobile';

/**
 * Sends SMS when configured via env. Falls back to server log when no provider is set.
 * Set SMS_WEBHOOK_URL to a POST endpoint that accepts { mobile, message }.
 */
export class SmsService {
  static async send(mobile: string, message: string): Promise<boolean> {
    const normalized = normalizeMobile(mobile);
    const webhook = process.env.SMS_WEBHOOK_URL?.trim();

    if (!webhook) {
      console.info(`[SmsService] (not configured) +91${normalized}: ${message}`);
      return false;
    }

    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: normalized, message }),
      });
      return res.ok;
    } catch (err) {
      console.error('[SmsService] send failed:', err);
      return false;
    }
  }
}
