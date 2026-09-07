/** Values in .env / host secrets are often wrapped in quotes; those quotes are not part of the key. */
function unquoteTrim(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  let value = String(raw).trim();
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    value = value.slice(1, -1).trim();
  }
  return value || null;
}

export function sanitizeVapidValue(raw: string | undefined | null): string | null {
  const value = unquoteTrim(raw);
  if (!value) return null;
  return value.replace(/\s+/g, '') || null;
}

export function readVapidPublicKey(): string | null {
  return (
    sanitizeVapidValue(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) ||
    sanitizeVapidValue(process.env.VAPID_PUBLIC_KEY)
  );
}

export function readVapidPrivateKey(): string | null {
  return sanitizeVapidValue(process.env.VAPID_PRIVATE_KEY);
}

export function readVapidSubject(): string {
  return unquoteTrim(process.env.VAPID_SUBJECT) || 'mailto:admin@gobaskitkaro.com';
}
