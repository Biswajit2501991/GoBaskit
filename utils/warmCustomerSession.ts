import {
  loadCheckoutProfileLocal,
  saveCheckoutProfileLocal,
  type SavedCheckoutProfile,
} from '@/utils/customerProfile';

export type WarmActiveOrder = {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  createdAt: string;
  itemCount: number;
};

export type WarmCustomerSession = {
  mobile: string | null;
  isWhatsappVerified: boolean;
  canCheckout: boolean;
  needsVerification: boolean | null;
  profile: SavedCheckoutProfile | null;
  activeOrders: WarmActiveOrder[];
  activeCount: number;
  notices: Array<{ id: string; message: string }>;
  wishlistKeys: string[];
  wishlistMax: number;
  warmedAt: number;
};

const TTL_MS = 3 * 60 * 1000;

let cache: WarmCustomerSession | null = null;
let inFlight: Promise<WarmCustomerSession> | null = null;

function emptySession(): WarmCustomerSession {
  return {
    mobile: null,
    isWhatsappVerified: false,
    canCheckout: false,
    needsVerification: null,
    profile: loadCheckoutProfileLocal(),
    activeOrders: [],
    activeCount: 0,
    notices: [],
    wishlistKeys: [],
    wishlistMax: 10,
    warmedAt: 0,
  };
}

/** Fresh cache hit within TTL, else null. */
export function getWarmCustomerSession(): WarmCustomerSession | null {
  if (!cache || !cache.warmedAt) return null;
  if (Date.now() - cache.warmedAt > TTL_MS) return null;
  return cache;
}

/** Last known snapshot even if stale (for instant paint + revalidate). */
export function peekWarmCustomerSession(): WarmCustomerSession | null {
  return cache;
}

export function clearWarmCustomerSession() {
  cache = null;
  inFlight = null;
}

/**
 * Warm account/profile/orders/notices/wishlist in one parallel pass after login.
 * Safe to call from Header, finishLogin, and account pages — deduped + TTL cached.
 */
export async function warmCustomerSession(opts?: {
  force?: boolean;
}): Promise<WarmCustomerSession> {
  if (typeof window === 'undefined') return emptySession();

  if (!opts?.force) {
    const hit = getWarmCustomerSession();
    if (hit) return hit;
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const accountRes = await fetch('/api/customer/account');
      const accountData = accountRes.ok ? await accountRes.json() : { mobile: null };
      const mobile = typeof accountData.mobile === 'string' ? accountData.mobile : null;
      const isWhatsappVerified = accountData.isWhatsappVerified === true;
      const canCheckout = accountData.canCheckout === true;
      const needsVerification =
        typeof accountData.needsVerification === 'boolean'
          ? accountData.needsVerification
          : null;

      if (!mobile) {
        const empty = {
          ...emptySession(),
          warmedAt: Date.now(),
        };
        cache = empty;
        return empty;
      }

      const [profileRes, ordersRes, noticesRes, wishlistRes] = await Promise.all([
        fetch('/api/customer/profile'),
        fetch('/api/customer/orders?active=1'),
        fetch('/api/customer/notices'),
        fetch('/api/customer/wishlist'),
      ]);

      let profile: SavedCheckoutProfile | null = null;
      if (profileRes.ok) {
        const data = await profileRes.json().catch(() => ({}));
        if (data.profile) {
          profile = data.profile as SavedCheckoutProfile;
          saveCheckoutProfileLocal(profile);
        }
      }
      if (!profile) profile = loadCheckoutProfileLocal();

      let activeOrders: WarmActiveOrder[] = [];
      let activeCount = 0;
      if (ordersRes.ok) {
        const data = await ordersRes.json().catch(() => ({}));
        activeOrders = Array.isArray(data.orders) ? data.orders : [];
        activeCount =
          typeof data.activeCount === 'number' ? data.activeCount : activeOrders.length;
      }

      let notices: Array<{ id: string; message: string }> = [];
      if (noticesRes.ok) {
        const data = await noticesRes.json().catch(() => ({}));
        notices = Array.isArray(data.notices)
          ? data.notices.map((n: { id: string; message: string }) => ({
              id: n.id,
              message: n.message,
            }))
          : [];
      }

      let wishlistKeys: string[] = [];
      let wishlistMax = 10;
      if (wishlistRes.ok) {
        const data = await wishlistRes.json().catch(() => ({}));
        wishlistKeys = Array.isArray(data.keys) ? data.keys : [];
        wishlistMax = typeof data.max === 'number' ? data.max : 10;
        try {
          const { useWishlistStore } = await import('@/store/wishlistStore');
          useWishlistStore.setState({
            keys: new Set(wishlistKeys),
            count: wishlistKeys.length,
            max: wishlistMax,
            loaded: true,
            loading: false,
          });
        } catch {
          /* ignore */
        }
      }

      // Fire-and-forget restock notices so toast host can stay light.
      void fetch('/api/customer/restock-notices').catch(() => null);

      const snapshot: WarmCustomerSession = {
        mobile,
        isWhatsappVerified,
        canCheckout,
        needsVerification,
        profile,
        activeOrders,
        activeCount,
        notices,
        wishlistKeys,
        wishlistMax,
        warmedAt: Date.now(),
      };
      cache = snapshot;
      return snapshot;
    } catch {
      const fallback = {
        ...emptySession(),
        warmedAt: Date.now(),
      };
      cache = fallback;
      return fallback;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
