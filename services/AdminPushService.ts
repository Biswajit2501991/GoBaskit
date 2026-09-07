import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { readVapidPrivateKey, readVapidPublicKey, readVapidSubject } from '@/lib/vapid';

/** Seconds FCM may retain the message. 60s drops Android deliveries delayed by Doze. */
export const ADMIN_PUSH_TTL_SECONDS = 24 * 60 * 60;

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = readVapidPublicKey();
  const privateKey = readVapidPrivateKey();
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(readVapidSubject(), publicKey, privateKey);
  } catch {
    return false;
  }
  configured = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  return readVapidPublicKey();
}

export class AdminPushService {
  static isConfigured(): boolean {
    return Boolean(readVapidPublicKey() && readVapidPrivateKey());
  }

  static async saveSubscription(params: {
    staffId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  }) {
    return prisma.staffPushSubscription.upsert({
      where: { endpoint: params.endpoint },
      create: {
        staffId: params.staffId,
        endpoint: params.endpoint,
        p256dh: params.p256dh,
        auth: params.auth,
        userAgent: params.userAgent ?? null,
      },
      update: {
        staffId: params.staffId,
        p256dh: params.p256dh,
        auth: params.auth,
        userAgent: params.userAgent ?? null,
      },
    });
  }

  static async removeSubscription(endpoint: string) {
    await prisma.staffPushSubscription.deleteMany({ where: { endpoint } });
  }

  static async notifyStaffIds(
    staffIds: string[],
    payload: { title: string; body: string; url?: string; tag?: string },
  ) {
    if (!staffIds.length || !ensureConfigured()) return;

    const subs = await prisma.staffPushSubscription.findMany({
      where: { staffId: { in: staffIds } },
    });
    if (!subs.length) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/admin/orders',
      tag: payload.tag || 'gobaskit-order',
    });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
            { urgency: 'high', TTL: ADMIN_PUSH_TTL_SECONDS },
          );
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          // Gone / expired subscription
          if (status === 404 || status === 410) {
            await prisma.staffPushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
          } else {
            console.error('[AdminPush] send failed', status, err);
          }
        }
      }),
    );
  }
}
