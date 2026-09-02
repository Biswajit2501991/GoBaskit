import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { requireSameOrigin } from '@/lib/security';
import { OrderFeedbackService } from '@/services/OrderFeedbackService';

const bodySchema = z.object({
  orderId: z.string().min(8),
  skipped: z.boolean().optional(),
  stars: z.number().int().min(1).max(5).optional(),
  note: z.string().max(600).optional(),
});

export async function POST(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Sign in to leave feedback' }, { status: 401 });
  }
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    if (parsed.data.skipped) {
      await OrderFeedbackService.skip({ mobile, orderId: parsed.data.orderId });
      return NextResponse.json({ ok: true, skipped: true });
    }
    if (!parsed.data.stars) {
      return NextResponse.json({ error: 'Choose a star rating' }, { status: 400 });
    }
    await OrderFeedbackService.submit({
      mobile,
      orderId: parsed.data.orderId,
      stars: parsed.data.stars,
      note: parsed.data.note,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save feedback';
    const status = message.includes('already recorded') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
