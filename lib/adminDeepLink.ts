/** Staff-only relative paths. Used after login and in Web Push click URLs. */

const ADMIN_PREFIX = '/admin/';
const MAX_LEN = 400;

export function sanitizeAdminNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let value = raw.trim();
  if (!value) return null;
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  value = value.trim();
  if (value.length > MAX_LEN) return null;
  if (!value.startsWith(ADMIN_PREFIX)) return null;
  if (value.startsWith('//') || value.includes('\\') || /[\r\n]/.test(value)) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, 'https://gobaskit.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'https://gobaskit.invalid') return null;
  if (url.username || url.password) return null;
  if (!url.pathname.startsWith(ADMIN_PREFIX)) return null;
  if (url.pathname === '/admin' || url.pathname === '/admin/') return null;

  const next = `${url.pathname}${url.search}`;
  if (next.length > MAX_LEN) return null;
  return next;
}

export function adminLoginHref(returnPath?: string | null): string {
  const next = sanitizeAdminNextPath(returnPath);
  if (!next) return '/admin';
  return `/admin?next=${encodeURIComponent(next)}`;
}

export function staffOrderDeepLink(orderId: string): string {
  const id = String(orderId ?? '').trim();
  if (!/^[a-z0-9_-]{8,40}$/i.test(id)) return '/admin/orders';
  return `/admin/orders?order=${encodeURIComponent(id)}`;
}
