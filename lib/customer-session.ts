import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import { isValidIndianMobile, normalizeMobile } from '@/utils/mobile';
import { COOKIE_NAME, verifyToken } from '@/lib/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export const CUSTOMER_MOBILE_COOKIE = 'gobaskit_customer_mobile';

/**
 * Long-lived customer session. Once a device proves ownership of a number once
 * (via WhatsApp verification), this signed cookie keeps it logged in.
 */
export const CUSTOMER_SESSION_MAX_AGE = 90 * 24 * 60 * 60; // 90 days

interface CustomerSessionPayload {
  mobile: string;
  type: 'customer';
}

/**
 * Signs a tamper-proof customer session token. This must ONLY be called after
 * ownership of the number has been proven (WhatsApp verification or an
 * authenticated staff member on their own number). Merely knowing a number must
 * never be enough to obtain one of these.
 */
export function createCustomerSessionToken(mobile: string): string {
  const normalized = normalizeMobile(mobile);
  const payload: CustomerSessionPayload = { mobile: normalized, type: 'customer' };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: CUSTOMER_SESSION_MAX_AGE });
}

export function customerSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: CUSTOMER_SESSION_MAX_AGE,
    path: '/',
  };
}

export function customerSessionClearOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  };
}

/** Extracts a verified mobile from a signed session cookie value. */
export function mobileFromSessionValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const decoded = jwt.verify(raw, JWT_SECRET) as CustomerSessionPayload;
    if (decoded?.type === 'customer' && isValidIndianMobile(decoded.mobile)) {
      return decoded.mobile;
    }
  } catch {
    // Not a valid signed session (e.g. a legacy plaintext cookie or a forged
    // value) — treat as logged out. This is what closes the "log in as any
    // number" gap: an unsigned number in the cookie is no longer trusted.
  }
  return null;
}

/**
 * Customer identity for storefront APIs: prefer the customer session cookie,
 * then fall back to a staff access token on their own number (dual-role shopping).
 */
export function getCustomerMobileFromRequest(req: NextRequest): string | null {
  const fromCustomer = mobileFromSessionValue(req.cookies.get(CUSTOMER_MOBILE_COOKIE)?.value);
  if (fromCustomer) return fromCustomer;

  const staffRaw = req.cookies.get(COOKIE_NAME)?.value;
  if (!staffRaw) return null;
  const session = verifyToken(staffRaw);
  if (!session || !('type' in session) || session.type !== 'staff') return null;
  const mobile = normalizeMobile(String(session.mobile ?? ''));
  return isValidIndianMobile(mobile) ? mobile : null;
}
