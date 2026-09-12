/**
 * Full browser logout for Go Baskit: clears staff + customer sessions on the
 * server (and revokes all staff refresh tokens), then hard-navigates Home.
 */
export async function logoutEverywhere(redirectTo = '/') {
  const request = {
    method: 'DELETE' as const,
    credentials: 'same-origin' as const,
    cache: 'no-store' as const,
  };
  await Promise.all([
    fetch('/api/auth/staff-login', request).catch(() => null),
    fetch('/api/customer/account', request).catch(() => null),
  ]);

  try {
    const { useWishlistStore } = await import('@/store/wishlistStore');
    useWishlistStore.getState().clear();
  } catch {
    /* ignore */
  }

  try {
    const { clearWarmCustomerSession } = await import('@/utils/warmCustomerSession');
    clearWarmCustomerSession();
  } catch {
    /* ignore */
  }

  try {
    const { useStaffPortalStore } = await import('@/store/staffPortalStore');
    useStaffPortalStore.getState().clearAccount();
  } catch {
    /* ignore */
  }

  try {
    const { clearSessionVerifiedMobile } = await import('@/utils/whatsappVerificationSession');
    clearSessionVerifiedMobile();
  } catch {
    /* ignore */
  }

  try {
    const { useAdminProductsStore } = await import('@/store/adminProductsStore');
    useAdminProductsStore.getState().invalidateProducts();
    useAdminProductsStore.getState().invalidateCategories();
  } catch {
    /* ignore */
  }

  const target = redirectTo.startsWith('/') ? redirectTo : '/';
  window.location.replace(target);
}
