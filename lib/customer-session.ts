import type { NextRequest } from 'next/server';
import { isValidIndianMobile, normalizeMobile } from '@/utils/mobile';

export const CUSTOMER_MOBILE_COOKIE = 'gobaskit_customer_mobile';

export function getCustomerMobileFromRequest(req: NextRequest): string | null {
  const raw = req.cookies.get(CUSTOMER_MOBILE_COOKIE)?.value || '';
  const mobile = normalizeMobile(raw);
  return isValidIndianMobile(mobile) ? mobile : null;
}
