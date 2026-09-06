import { randomBytes } from 'crypto';

export const CHECKOUT_CODES = {
  LOGIN_REQUIRED: 'LOGIN_REQUIRED',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  MOBILE_MISMATCH: 'MOBILE_MISMATCH',
  STOCK: 'STOCK',
  UNAVAILABLE: 'UNAVAILABLE',
  PRICE_CHANGED: 'PRICE_CHANGED',
  DISCOUNT: 'DISCOUNT',
  RETRY: 'RETRY',
  EMPTY: 'EMPTY',
  INVALID: 'INVALID',
  FAILED: 'FAILED',
} as const;

export type CheckoutErrorCode = (typeof CHECKOUT_CODES)[keyof typeof CHECKOUT_CODES];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  return UUID_RE.test(key) ? key : null;
}

/** Unique, still human-readable: GB + hex + time fragment. */
export function generateOrderNumber(): string {
  const rand = randomBytes(4).toString('hex').toUpperCase();
  const time = Date.now().toString(36).toUpperCase().slice(-5);
  return `GB${rand}${time}`;
}

export function amountsClose(a: number, b: number, tolerance = 0.5): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function uniqueConstraintField(err: unknown): string | null {
  const meta = err && typeof err === 'object' && 'meta' in err ? (err as { meta?: { target?: unknown } }).meta : undefined;
  const target = meta?.target;
  if (Array.isArray(target)) return target.map(String).join(',');
  if (typeof target === 'string') return target;
  return null;
}

export function isIdempotencyKeyConflict(err: unknown): boolean {
  const field = uniqueConstraintField(err);
  if (!field) return false;
  return field.includes('idempotency_key') || field.includes('idempotencyKey');
}

export function isOrderNumberConflict(err: unknown): boolean {
  const field = uniqueConstraintField(err);
  if (!field) return false;
  return field.includes('order_number') || field.includes('orderNumber');
}

export function stockOrUnavailableCode(message: string): CheckoutErrorCode {
  if (/stock|no longer available|out of stock|only \d+/i.test(message)) return CHECKOUT_CODES.STOCK;
  if (/unavailable|not delivering/i.test(message)) return CHECKOUT_CODES.UNAVAILABLE;
  return CHECKOUT_CODES.FAILED;
}
