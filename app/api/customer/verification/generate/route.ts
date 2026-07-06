import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';
import { getRequestMeta } from '@/lib/request-meta';
import { isValidE164 } from '@/utils/phone';

const bodySchema = z.object({
  mobile: z.string().min(8).max(20),
  customerName: z.string().max(120).optional(),
  forceNew: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const mobile = parsed.data.mobile.trim();
  if (!isValidE164(mobile)) {
    return NextResponse.json({ error: 'Enter a valid mobile number with country code' }, { status: 400 });
  }

  try {
    const meta = getRequestMeta(req);
    const result = await WhatsAppVerificationService.getOrCreateVerification({
      mobileE164: mobile,
      customerName: parsed.data.customerName,
      forceNew: parsed.data.forceNew,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate verification code';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
