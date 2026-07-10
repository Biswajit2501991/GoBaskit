import {
  loadCheckoutProfileLocal,
  saveCheckoutProfileLocal,
  type SavedCheckoutProfile,
} from '@/utils/customerProfile';

type PrefetchResult = {
  profile: SavedCheckoutProfile | null;
  mobile: string | null;
  isWhatsappVerified: boolean;
  canCheckout: boolean;
  needsVerification: boolean | null;
};

let inFlight: Promise<PrefetchResult> | null = null;

/**
 * Warm the checkout profile cache as soon as we know the customer session.
 * Safe to call from Header / cart — checkout then fills instantly from localStorage.
 */
export async function prefetchCheckoutProfile(): Promise<PrefetchResult> {
  if (typeof window === 'undefined') {
    return {
      profile: null,
      mobile: null,
      isWhatsappVerified: false,
      canCheckout: false,
      needsVerification: null,
    };
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const accountRes = await fetch('/api/customer/account');
      const accountData = accountRes.ok
        ? await accountRes.json()
        : { mobile: null };
      const mobile = typeof accountData.mobile === 'string' ? accountData.mobile : null;
      const isWhatsappVerified = accountData.isWhatsappVerified === true;
      const canCheckout = accountData.canCheckout === true;
      const needsVerification =
        typeof accountData.needsVerification === 'boolean'
          ? accountData.needsVerification
          : null;

      if (!mobile) {
        return {
          profile: loadCheckoutProfileLocal(),
          mobile: null,
          isWhatsappVerified: false,
          canCheckout: false,
          needsVerification: null,
        };
      }

      const profileRes = await fetch('/api/customer/profile');
      if (profileRes.ok) {
        const data = await profileRes.json();
        if (data.profile) {
          saveCheckoutProfileLocal(data.profile);
          return {
            profile: data.profile as SavedCheckoutProfile,
            mobile,
            isWhatsappVerified,
            canCheckout,
            needsVerification,
          };
        }
      }

      return {
        profile: loadCheckoutProfileLocal(),
        mobile,
        isWhatsappVerified,
        canCheckout,
        needsVerification,
      };
    } catch {
      return {
        profile: loadCheckoutProfileLocal(),
        mobile: null,
        isWhatsappVerified: false,
        canCheckout: false,
        needsVerification: null,
      };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
