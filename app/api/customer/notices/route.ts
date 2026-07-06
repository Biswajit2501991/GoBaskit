import { NextResponse } from 'next/server';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { CustomerNoticeService } from '@/services/CustomerNoticeService';

export async function GET(req: Request) {
  const mobile = getCustomerMobileFromRequest(req as import('next/server').NextRequest);
  if (!mobile) {
    return NextResponse.json({ notices: [] });
  }

  const notices = await CustomerNoticeService.listActiveForMobile(mobile);
  return NextResponse.json({
    notices: notices.map((n) => ({
      id: n.id,
      message: n.message,
      orderId: n.orderId,
      expiresAt: n.expiresAt.toISOString(),
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
