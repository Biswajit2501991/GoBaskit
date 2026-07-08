import { NextRequest, NextResponse } from 'next/server';
import { isValidE164 } from '@/utils/phone';
import { CustomerAuthService } from '@/services/CustomerAuthService';

export async function GET(req: NextRequest) {
  const mobile = req.nextUrl.searchParams.get('mobile')?.trim() ?? '';
  if (!isValidE164(mobile)) {
    return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
  }

  const status = await CustomerAuthService.getAuthStatus(mobile);
  return NextResponse.json({ mobile, ...status });
}
