/**
 * Full browser logout for Go Baskit: clears staff + customer sessions on the
 * server (and revokes all staff refresh tokens), then hard-navigates Home.
 */
export async function logoutEverywhere(redirectTo = '/') {
  await Promise.all([
    fetch('/api/auth/staff-login', { method: 'DELETE' }).catch(() => null),
    fetch('/api/customer/account', { method: 'DELETE' }).catch(() => null),
  ]);

  try {
    const { useWishlistStore } = await import('@/store/wishlistStore');
    useWishlistStore.getState().clear();
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

  window.location.replace(redirectTo);
}
