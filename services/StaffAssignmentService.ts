import type { StaffRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cityIsServiceable, distanceKm, normalizeLocationToken } from '@/utils/delivery';

/** Roles that always receive every order notification (Owner / Admin). */
export const ADMIN_NOTIFICATION_ROLES: StaffRole[] = [
  'ALL_SUPER_ADMIN',
  'SUPER_ADMIN',
  'MANAGER',
  'ORDER_MANAGER',
];

export interface OrderLocationContext {
  city: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  cityAliases?: Record<string, string[]>;
  serviceableCities?: string[];
}

export class StaffAssignmentService {
  /** Find delivery staff whose zone matches the customer location. */
  static async findMatchingStaff(ctx: OrderLocationContext) {
    const staff = await prisma.staffAccount.findMany({
      where: { active: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        role: true,
        assignedCity: true,
        assignedAreas: true,
        latitude: true,
        longitude: true,
        deliveryRadius: true,
      },
    });

    const customerCity = normalizeLocationToken(ctx.city);

    return staff.filter((member) => {
      if (ADMIN_NOTIFICATION_ROLES.includes(member.role)) return false;

      if (member.assignedCity) {
        const staffCity = normalizeLocationToken(member.assignedCity);
        if (staffCity && staffCity === customerCity) return true;
        if (
          cityIsServiceable([member.assignedCity], ctx.city, ctx.cityAliases ?? {})
        ) {
          return true;
        }
      }

      const areas = Array.isArray(member.assignedAreas)
        ? (member.assignedAreas as string[])
        : [];
      if (areas.some((a) => normalizeLocationToken(a) === customerCity)) {
        return true;
      }

      if (
        ctx.latitude != null &&
        ctx.longitude != null &&
        member.latitude != null &&
        member.longitude != null &&
        member.deliveryRadius != null &&
        member.deliveryRadius > 0
      ) {
        const km = distanceKm(
          ctx.latitude,
          ctx.longitude,
          member.latitude,
          member.longitude,
        );
        if (km <= member.deliveryRadius) return true;
      }

      return false;
    });
  }

  /** Staff IDs that should receive a notification for this order. */
  static async getNotificationRecipients(ctx: OrderLocationContext): Promise<string[]> {
    const allStaff = await prisma.staffAccount.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, role: true },
    });

    const adminIds = allStaff
      .filter((s) => ADMIN_NOTIFICATION_ROLES.includes(s.role))
      .map((s) => s.id);

    const matched = await this.findMatchingStaff(ctx);
    const matchedIds = matched.map((s) => s.id);

    if (matchedIds.length === 0) {
      return [...new Set(adminIds)];
    }

    return [...new Set([...adminIds, ...matchedIds])];
  }
}
