import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AdminPushService, getVapidPublicKey } from '@/services/AdminPushService';

export async function GET() {
  const auth = await requireStaffSession();
  if (auth.error) return auth.error;
  return NextResponse.json({
    configured: AdminPushService.isConfigured(),
    publicKey: getVapidPublicKey(),
  });
}

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(5),
  }),
});

export async function POST(req: NextRequest) {
  const auth = await requireStaffSession();
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  if (!AdminPushService.isConfigured()) {
    return NextResponse.json({ error: 'Push notifications are not configured on the server' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await AdminPushService.saveSubscription({
    staffId: auth.staff!.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: req.headers.get('user-agent'),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireStaffSession();
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 });

  await AdminPushService.removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
