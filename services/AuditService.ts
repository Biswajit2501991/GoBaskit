import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { Prisma as PrismaClient } from '@prisma/client';

export class AuditService {
  static async log(params: {
    staffId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    meta?: Record<string, unknown>;
    ip?: string;
  }) {
    const data = {
      staffId: params.staffId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      meta: (params.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: params.ip,
    };

    try {
      await prisma.auditLog.create({ data });
    } catch (error) {
      // Legacy admin sessions can produce IDs that are not in staff_accounts.
      // In those cases, keep the audit row and drop the actor reference.
      if (
        params.staffId &&
        error instanceof PrismaClient.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        await prisma.auditLog.create({
          data: {
            ...data,
            staffId: null,
          },
        });
        return;
      }
      throw error;
    }
  }
}
