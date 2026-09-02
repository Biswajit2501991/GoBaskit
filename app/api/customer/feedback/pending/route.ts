import { NextRequest, NextResponse } from 'next/server';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { OrderFeedbackService } from '@/services/OrderFeedbackService';

export async function GET(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ pending: false });
  }

  try {
    const pending = await OrderFeedbackService.pendingForMobile(mobile);
    if (!pending) return NextResponse.json({ pending: false });
    return NextResponse.json({ pending: true, ...pending });
  } catch (err) {
    console.error('[customer-feedback] pending failed', err);
    return NextResponse.json({ pending: false });
  }
}
