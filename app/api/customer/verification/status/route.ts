import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';
import { isValidE164 } from '@/utils/phone';

export async function GET(req: NextRequest) {
  const mobile = req.nextUrl.searchParams.get('mobile')?.trim() ?? '';
  const verificationId = req.nextUrl.searchParams.get('verificationId')?.trim() || undefined;
  if (!isValidE164(mobile)) {
    return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
  }

  try {
    const status = await WhatsAppVerificationService.getStatus(mobile, verificationId);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to check status';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
