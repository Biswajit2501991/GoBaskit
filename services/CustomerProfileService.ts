import { prisma } from '@/lib/prisma';
import { normalizeMobile } from '@/utils/mobile';
import type { SavedCheckoutProfile } from '@/utils/customerProfile';

const PROFILE_PREFIX = 'customer_profile_';

function profileKey(mobile: string) {
  return `${PROFILE_PREFIX}${normalizeMobile(mobile)}`;
}

type CustomerRecord = {
  firstName: string;
  lastName: string;
  mobile: string;
  alternateMobile?: string | null;
  houseNumber: string;
  street: string;
  area: string;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
};

export class CustomerProfileService {
  static profileFromCustomer(customer: CustomerRecord): SavedCheckoutProfile {
    return {
      firstName: customer.firstName,
      lastName: customer.lastName,
      mobile: normalizeMobile(customer.mobile),
      alternateMobile: customer.alternateMobile || undefined,
      houseNumber: customer.houseNumber,
      street: customer.street,
      area: customer.area,
      landmark: customer.landmark || undefined,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
    };
  }

  static async save(mobile: string, profile: SavedCheckoutProfile): Promise<void> {
    const normalized = normalizeMobile(mobile);
    const payload = { ...profile, mobile: normalized };
    await prisma.setting.upsert({
      where: { key: profileKey(normalized) },
      update: { value: JSON.stringify(payload) },
      create: { key: profileKey(normalized), value: JSON.stringify(payload) },
    });
  }

  static async load(mobile: string): Promise<SavedCheckoutProfile | null> {
    const row = await prisma.setting.findUnique({
      where: { key: profileKey(mobile) },
    });
    if (!row) return null;
    try {
      const parsed = JSON.parse(row.value) as SavedCheckoutProfile;
      if (!parsed?.firstName || !parsed?.mobile) return null;
      return { ...parsed, mobile: normalizeMobile(parsed.mobile) };
    } catch {
      return null;
    }
  }
}
