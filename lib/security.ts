function expectedOrigins(req: Request): string[] {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

  const origins = new Set<string>();
  if (host) origins.add(`${proto}://${host}`);
  if (appUrl) origins.add(appUrl.replace(/\/+$/, ''));
  return Array.from(origins);
}

/**
 * Lightweight CSRF protection for cookie-authenticated mutation routes.
 * Allows same-origin browser calls and blocks cross-site POST/PUT/PATCH/DELETE.
 */
export function requireSameOrigin(req: Request) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null;
  }

  const origin = req.headers.get('origin');
  if (!origin) {
    // Non-browser or local tool calls: allow in non-production for DX.
    if (process.env.NODE_ENV !== 'production') return null;
    return 'Missing origin header';
  }

  const allowed = expectedOrigins(req);
  if (!allowed.includes(origin)) {
    return 'Cross-site request blocked';
  }
  return null;
}
