import { prisma } from '@/lib/prisma';
import type { SavedCheckoutProfile } from '@/utils/customerProfile';

const PROFILE_PREFIX = 'customer_profile_';

function profileKey(mobile: string) {
  return `${PROFILE_PREFIX}${mobile}`;
}

export class CustomerProfileService {
  static async save(mobile: string, profile: SavedCheckoutProfile): Promise<void> {
    await prisma.setting.upsert({
      where: { key: profileKey(mobile) },
      update: { value: JSON.stringify(profile) },
      create: { key: profileKey(mobile), value: JSON.stringify(profile) },
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
      return parsed;
    } catch {
      return null;
    }
  }
}
