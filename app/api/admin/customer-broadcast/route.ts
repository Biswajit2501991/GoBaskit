import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/staff-auth';
import { requireSameOrigin } from '@/lib/security';
import { AuditService } from '@/services/AuditService';
import { CustomerPushService } from '@/services/CustomerPushService';
import {
  BROADCAST_BODY_MAX,
  BROADCAST_TITLE_MAX,
  sanitizeBroadcastText,
} from '@/lib/customerBroadcastPush';

const BROADCAST_COOLDOWN_MS = 45_000;
let lastBroadcastAt = 0;
let broadcastInFlight = false;

const bodySchema = z.object({
  title: z.string().min(1).max(BROADCAST_TITLE_MAX + 20),
  message: z.string().min(1).max(BROADCAST_BODY_MAX + 40),
});

export async function GET() {
  const auth = await requireStaffPermission('settings:view');
  if (auth.error) return auth.error;

  const counts = await CustomerPushService.countEnabled();
  return NextResponse.json({
    configured: CustomerPushService.isConfigured(),
    devices: counts.devices,
    customers: counts.customers,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffPermission('settings:edit', { live: true });
  if (auth.error) return auth.error;
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a title and message.' }, { status: 400 });
  }

  const title = sanitizeBroadcastText(parsed.data.title, BROADCAST_TITLE_MAX);
  const message = sanitizeBroadcastText(parsed.data.message, BROADCAST_BODY_MAX);
  if (!title || !message) {
    return NextResponse.json({ error: 'Enter a title and message.' }, { status: 400 });
  }

  const now = Date.now();
  if (broadcastInFlight || now - lastBroadcastAt < BROADCAST_COOLDOWN_MS) {
    return NextResponse.json(
      { error: 'Please wait a moment before sending another broadcast.' },
      { status: 429 },
    );
  }

  broadcastInFlight = true;
  try {
    const result = await CustomerPushService.broadcastToEnabled({ title, message });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    lastBroadcastAt = Date.now();
    const staffId = auth.staff?.id;
    after(() => {
      AuditService.log({
        staffId,
        action: 'customer_broadcast_sent',
        entity: 'customer_push',
        meta: {
          title,
          devices: result.devices,
          sent: result.sent,
          gone: result.gone,
        },
      }).catch((err) => console.error('[customer-broadcast] audit log failed', err));
    });
    return NextResponse.json({
      ok: true,
      devices: result.devices,
      sent: result.sent,
      gone: result.gone,
    });
  } finally {
    broadcastInFlight = false;
  }
}
