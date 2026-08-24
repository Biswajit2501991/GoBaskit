import { normalizeMobile } from '@/utils/mobile';

/** True when this browser already has a different customer than the number now signing in. */
export function shouldReleaseCustomerSession(
  currentMobile: string | null | undefined,
  incomingMobile: string,
): boolean {
  const current = normalizeMobile(String(currentMobile ?? ''));
  const incoming = normalizeMobile(incomingMobile);
  return Boolean(current && incoming && current !== incoming);
}

/**
 * If another customer (or leftover cookie) is on this device, drop only the
 * storefront session so the new number can verify/login. Does not sign staff out
 * and does not navigate away (login modal stays open).
 */
export async function releaseOtherCustomerSession(incomingMobile10: string): Promise<void> {
  const incoming = normalizeMobile(incomingMobile10);
  if (!incoming) return;

  let cookieMobile = '';
  try {
    const res = await fetch('/api/customer/account', {
      credentials: 'include',
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as { mobile?: string | null };
    cookieMobile = typeof data.mobile === 'string' ? normalizeMobile(data.mobile) : '';
  } catch {
    /* still inspect in-memory identity */
  }

  const { useStaffPortalStore } = await import('@/store/staffPortalStore');
  const storeMobile = normalizeMobile(useStaffPortalStore.getState().customerMobile || '');

  if (
    !shouldReleaseCustomerSession(cookieMobile, incoming) &&
    !shouldReleaseCustomerSession(storeMobile, incoming)
  ) {
    return;
  }

  await fetch('/api/customer/account?customerOnly=1', {
    method: 'DELETE',
    credentials: 'include',
  }).catch(() => null);

  try {
    const { clearSessionVerifiedMobile } = await import('@/utils/whatsappVerificationSession');
    clearSessionVerifiedMobile();
  } catch {
    /* ignore */
  }

  try {
    const { clearWarmCustomerSession } = await import('@/utils/warmCustomerSession');
    clearWarmCustomerSession();
  } catch {
    /* ignore */
  }

  useStaffPortalStore.getState().clearCustomerShoppingIdentity();

  try {
    const { useWishlistStore } = await import('@/store/wishlistStore');
    useWishlistStore.getState().clear();
  } catch {
    /* ignore */
  }
}
