import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerMobileFromRequest } from '@/lib/customer-session';
import { requireSameOrigin } from '@/lib/security';
import { WishlistService } from '@/services/WishlistService';

export async function GET(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ notices: [] });
  }

  const notices = await WishlistService.collectRestockNotices(mobile);
  return NextResponse.json({ notices });
}

const dismissSchema = z.object({
  ids: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const mobile = getCustomerMobileFromRequest(req);
  if (!mobile) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  const originError = requireSameOrigin(req);
  if (originError) return NextResponse.json({ error: originError }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = dismissSchema.safeParse(body);
  await WishlistService.markNoticesRead(mobile, parsed.success ? parsed.data.ids : undefined);
  return NextResponse.json({ ok: true });
}
