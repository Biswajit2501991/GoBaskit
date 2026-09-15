import { prisma } from '@/lib/prisma';
import { SettingsService } from '@/services/SettingsService';

export class PartnerDeliveryError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

export class PartnerDeliveryService {
  static async isEnabled(): Promise<boolean> {
    return (await SettingsService.getStoreConfig()).partnerDeliveryEnabled === true;
  }

  static async clearAllOnline(): Promise<void> {
    await prisma.staffAccount.updateMany({
      where: { deliveryOnline: true },
      data: { deliveryOnline: false, deliveryOnlineAt: null },
    });
  }

  static async setOnline(staffId: string, online: boolean) {
    if (online && !(await this.isEnabled())) {
      throw new PartnerDeliveryError('Partner delivery is turned off', 403);
    }
    const now = online ? new Date() : null;
    const staff = await prisma.staffAccount.update({
      where: { id: staffId },
      data: { deliveryOnline: online, deliveryOnlineAt: now },
      select: { deliveryOnline: true, deliveryOnlineAt: true, name: true },
    });
    return {
      enabled: await this.isEnabled(),
      online: staff.deliveryOnline,
      onlineAt: staff.deliveryOnlineAt?.toISOString() ?? null,
      name: staff.name,
    };
  }

  static async sessionFor(staff: { id: string; name: string }) {
    const enabled = await this.isEnabled();
    const row = await prisma.staffAccount.findFirst({
      where: { id: staff.id, active: true, deletedAt: null },
      select: { deliveryOnline: true, deliveryOnlineAt: true, name: true },
    });
    if (!enabled && row?.deliveryOnline) {
      await this.clearOnline(staff.id);
      return { enabled: false, online: false, onlineAt: null as string | null, name: row.name };
    }
    return {
      enabled,
      online: row?.deliveryOnline === true,
      onlineAt: row?.deliveryOnlineAt?.toISOString() ?? null,
      name: row?.name ?? staff.name,
    };
  }

  static async clearOnline(staffId: string) {
    await prisma.staffAccount.updateMany({
      where: { id: staffId, deliveryOnline: true },
      data: { deliveryOnline: false, deliveryOnlineAt: null },
    });
  }
}
