const STORAGE_KEY = 'gobaskit_checkout_idempotency';

function cartFingerprint(
  items: Array<{ productId: string; variantId?: string | null; quantity: number }>,
): string {
  return items
    .map((i) => `${i.productId}:${i.variantId ?? ''}:${i.quantity}`)
    .sort()
    .join('|');
}

export function getOrCreateCheckoutIdempotencyKey(
  items: Array<{ productId: string; variantId?: string | null; quantity: number }>,
): string {
  const fp = cartFingerprint(items);
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { fp?: string; key?: string };
      if (parsed.fp === fp && typeof parsed.key === 'string' && parsed.key.length > 8) {
        return parsed.key;
      }
    }
  } catch {
    /* ignore */
  }

  const key = crypto.randomUUID();
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ fp, key }));
  } catch {
    /* private mode — still send this key for this page life */
  }
  return key;
}

export function clearCheckoutIdempotencyKey(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
