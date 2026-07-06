import { prisma } from '@/lib/prisma';
import type { StaffRole } from '@prisma/client';
import { parsePermissions } from '@/types/staff';

const CACHE_TTL_MS = 5 * 60 * 1000;
const mobileCache = new Map<string, { found: boolean; expires: number }>();

export class StaffService {
  /** Cached mobile lookup — reduces DB reads for repeat checks in same session. */
  static async isStaffMobile(mobile: string): Promise<boolean> {
    const cached = mobileCache.get(mobile);
    if (cached && cached.expires > Date.now()) return cached.found;

    const staff = await prisma.staffAccount.findFirst({
      where: { mobile, active: true, deletedAt: null },
      select: { id: true },
    });
    const found = Boolean(staff);
    mobileCache.set(mobile, { found, expires: Date.now() + CACHE_TTL_MS });
    return found;
  }

  static invalidateMobileCache(mobile: string) {
    mobileCache.delete(mobile);
  }

  static async findByMobile(mobile: string) {
    return prisma.staffAccount.findFirst({
      where: { mobile, active: true, deletedAt: null },
    });
  }

  static async findById(id: string) {
    return prisma.staffAccount.findFirst({
      where: { id, deletedAt: null },
    });
  }

  static async list(params: { search?: string; role?: StaffRole; active?: boolean; page?: number; pageSize?: number }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 100);
    const where = {
      deletedAt: null,
      ...(params.role ? { role: params.role } : {}),
      ...(params.active !== undefined ? { active: params.active } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' as const } },
              { mobile: { contains: params.search } },
              { email: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.staffAccount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          mobile: true,
          email: true,
          name: true,
          role: true,
          permissions: true,
          active: true,
          assignedCity: true,
          assignedAreas: true,
          latitude: true,
          longitude: true,
          deliveryRadius: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.staffAccount.count({ where }),
    ]);

    return {
      items: items.map((s) => ({
        ...s,
        permissions: parsePermissions(s.permissions),
        assignedAreas: Array.isArray(s.assignedAreas) ? (s.assignedAreas as string[]) : [],
      })),
      total,
      page,
      pageSize,
    };
  }

  static async recordLoginAttempt(mobile: string, success: boolean, ip?: string) {
    await prisma.staffLoginAttempt.create({ data: { mobile, success, ip } });
  }

  static async countRecentFailedAttempts(mobile: string, windowMinutes = 15): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    return prisma.staffLoginAttempt.count({
      where: { mobile, success: false, createdAt: { gte: since } },
    });
  }

  static async updateLastLogin(id: string) {
    await prisma.staffAccount.update({ where: { id }, data: { lastLogin: new Date() } });
  }
}
