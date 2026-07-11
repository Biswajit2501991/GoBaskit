import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';
import { getRequestMeta } from '@/lib/request-meta';
import { isValidE164 } from '@/utils/phone';

const bodySchema = z.object({
  mobile: z.string().min(8).max(20),
  verificationId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const mobile = parsed.data.mobile.trim();
  if (!isValidE164(mobile)) {
    return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
  }

  const meta = getRequestMeta(req);
  const status = await WhatsAppVerificationService.logSentAck({
    mobileE164: mobile,
    verificationId: parsed.data.verificationId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true, ...status });
}
