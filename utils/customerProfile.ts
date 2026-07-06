import type { CheckoutSchema } from '@/lib/validations';

const STORAGE_KEY = 'gobaskit_checkout_profile';

export interface SavedCheckoutProfile {
  firstName: string;
  lastName: string;
  mobile: string;
  alternateMobile?: string;
  houseNumber: string;
  street: string;
  area: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  deliveryNotes?: string;
}

export function profileFromCheckout(data: CheckoutSchema): SavedCheckoutProfile {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    mobile: data.mobile,
    alternateMobile: data.alternateMobile || undefined,
    houseNumber: data.houseNumber,
    street: data.street,
    area: data.area,
    landmark: data.landmark || undefined,
    city: data.city,
    state: data.state,
    pincode: data.pincode,
    deliveryNotes: data.deliveryNotes || undefined,
  };
}

export function saveCheckoutProfileLocal(profile: SavedCheckoutProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* private mode */
  }
}

export function loadCheckoutProfileLocal(): SavedCheckoutProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedCheckoutProfile;
    if (!parsed?.firstName || !parsed?.mobile) return null;
    return parsed;
  } catch {
    return null;
  }
}
