import { warmCustomerSession } from '@/utils/warmCustomerSession';
import {
  loadCheckoutProfileLocal,
  type SavedCheckoutProfile,
} from '@/utils/customerProfile';

type PrefetchResult = {
  profile: SavedCheckoutProfile | null;
  mobile: string | null;
  isWhatsappVerified: boolean;
  canCheckout: boolean;
  needsVerification: boolean | null;
};

/**
 * Warm the checkout profile cache as soon as we know the customer session.
 * Delegates to warmCustomerSession so account/orders/wishlist warm together.
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

  const warm = await warmCustomerSession();
  return {
    profile: warm.profile ?? loadCheckoutProfileLocal(),
    mobile: warm.mobile,
    isWhatsappVerified: warm.isWhatsappVerified,
    canCheckout: warm.canCheckout,
    needsVerification: warm.needsVerification,
  };
}
