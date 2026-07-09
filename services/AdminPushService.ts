import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@gobaskitkaro.com';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.VAPID_PUBLIC_KEY?.trim() ||
    null
  );
}

export class AdminPushService {
  static isConfigured(): boolean {
    return Boolean(getVapidPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim());
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
            { urgency: 'high', TTL: 60 },
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
