import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { requireSameOrigin } from '@/lib/security';
import { prisma } from '@/lib/prisma';
import { getVapidPublicKey } from '@/services/AdminPushService';
import { CustomerPushService } from '@/services/CustomerPushService';
import { isValidIndianMobile, normalizeMobile } from '@/utils/mobile';
import { mobileVariantsFromE164, toE164 } from '@/utils/phone';

async function customerMobileRow(mobile10: string) {
  const e164 = toE164('91', mobile10);
  const variants = e164 ? mobileVariantsFromE164(e164) : [mobile10];
  return prisma.customerMobile.findFirst({
    where: { mobile: { in: variants } },
    select: { id: true },
  });
}

export async function GET(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Sign in to enable order alerts' }, { status: 401 });
  }

  const subscribed = await CustomerPushService.hasSubscriptionForMobile(mobile);
  return NextResponse.json({
    configured: CustomerPushService.isConfigured(),
    publicKey: getVapidPublicKey(),
    subscribed,
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
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Sign in to enable order alerts' }, { status: 401 });
  }
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  if (!CustomerPushService.isConfigured()) {
    return NextResponse.json({ error: 'Push notifications are not configured on the server' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const national = normalizeMobile(mobile);
  if (!isValidIndianMobile(national)) {
    return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
  }

  let account = await customerMobileRow(national);
  if (!account) {
    account = await prisma.customerMobile.create({
      data: { mobile: national },
      select: { id: true },
    });
  }

  await CustomerPushService.saveSubscription({
    customerMobileId: account.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: req.headers.get('user-agent'),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Sign in to enable order alerts' }, { status: 401 });
  }
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 });

  await CustomerPushService.removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
