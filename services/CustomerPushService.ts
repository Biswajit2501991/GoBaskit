import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { getVapidPublicKey } from '@/services/AdminPushService';
import { outForDeliveryPushPayload } from '@/lib/customerOutForDeliveryPush';
import { customerBroadcastPayload } from '@/lib/customerBroadcastPush';
import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';
import { mobileVariantsFromE164, toE164 } from '@/utils/phone';

export const CUSTOMER_PUSH_TTL_SECONDS = 24 * 60 * 60;

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@gobaskitkaro.com';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export class CustomerPushService {
  static isConfigured(): boolean {
    return Boolean(getVapidPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim());
  }

  static async saveSubscription(params: {
    customerMobileId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  }) {
    return prisma.customerPushSubscription.upsert({
      where: { endpoint: params.endpoint },
      create: {
        customerMobileId: params.customerMobileId,
        endpoint: params.endpoint,
        p256dh: params.p256dh,
        auth: params.auth,
        userAgent: params.userAgent ?? null,
      },
      update: {
        customerMobileId: params.customerMobileId,
        p256dh: params.p256dh,
        auth: params.auth,
        userAgent: params.userAgent ?? null,
      },
    });
  }

  static async removeSubscription(endpoint: string) {
    await prisma.customerPushSubscription.deleteMany({ where: { endpoint } });
  }

  static async hasSubscriptionForMobile(mobile10: string): Promise<boolean> {
    const account = await this.findCustomerMobile(mobile10);
    if (!account) return false;
    const count = await prisma.customerPushSubscription.count({
      where: { customerMobileId: account.id },
    });
    return count > 0;
  }

  static async notifyOutForDelivery(params: {
    orderId: string;
    orderNumber: string;
    customerMobile: string;
  }) {
    if (!ensureConfigured()) return;

    const account = await this.findCustomerMobile(params.customerMobile);
    if (!account) return;

    const subs = await prisma.customerPushSubscription.findMany({
      where: { customerMobileId: account.id },
    });
    if (!subs.length) return;

    const payload = outForDeliveryPushPayload({
      id: params.orderId,
      orderNumber: params.orderNumber,
    });
    const body = JSON.stringify(payload);

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
            { urgency: 'high', TTL: CUSTOMER_PUSH_TTL_SECONDS },
          );
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await prisma.customerPushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
          } else {
            console.error('[CustomerPush] send failed', status, err);
          }
        }
      }),
    );
  }

  static async countEnabled(): Promise<{ devices: number; customers: number }> {
    const [devices, grouped] = await Promise.all([
      prisma.customerPushSubscription.count(),
      prisma.customerPushSubscription.groupBy({
        by: ['customerMobileId'],
        _count: { _all: true },
      }),
    ]);
    return { devices, customers: grouped.length };
  }

  /** Push to every saved customer subscription. Does not change store settings or orders. */
  static async broadcastToEnabled(input: { title: string; message: string }): Promise<{
    ok: true;
    devices: number;
    sent: number;
    gone: number;
  } | { ok: false; error: string }> {
    if (!ensureConfigured()) {
      return { ok: false, error: 'Customer push is not configured on the server.' };
    }
    const payload = customerBroadcastPayload(input);
    if (!payload.title || !payload.body) {
      return { ok: false, error: 'Title and message are required.' };
    }

    const subs = await prisma.customerPushSubscription.findMany({
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (!subs.length) {
      return { ok: false, error: 'No customers have enabled alerts yet.' };
    }

    const body = JSON.stringify(payload);
    let sent = 0;
    let gone = 0;
    const chunkSize = 25;
    for (let i = 0; i < subs.length; i += chunkSize) {
      const chunk = subs.slice(i, i + chunkSize);
      const outcomes = await Promise.all(
        chunk.map(async (sub): Promise<'sent' | 'gone' | 'fail'> => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              body,
              { urgency: 'normal', TTL: CUSTOMER_PUSH_TTL_SECONDS },
            );
            return 'sent';
          } catch (err) {
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410) {
              await prisma.customerPushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
              return 'gone';
            }
            console.error('[CustomerPush] broadcast failed', status, err);
            return 'fail';
          }
        }),
      );
      for (const outcome of outcomes) {
        if (outcome === 'sent') sent += 1;
        if (outcome === 'gone') gone += 1;
      }
    }

    return { ok: true, devices: subs.length, sent, gone };
  }

  private static async findCustomerMobile(rawMobile: string) {
    const national = normalizeMobile(rawMobile);
    const variants = new Set<string>();
    if (national) variants.add(national);
    if (isValidIndianMobile(national)) {
      const e164 = toE164('91', national);
      if (e164) mobileVariantsFromE164(e164).forEach((v) => variants.add(v));
    }
    if (!variants.size) return null;
    return prisma.customerMobile.findFirst({
      where: { mobile: { in: [...variants] } },
      select: { id: true },
    });
  }
}
