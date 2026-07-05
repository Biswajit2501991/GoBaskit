import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export class AuditService {
  static async log(params: {
    staffId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    meta?: Record<string, unknown>;
    ip?: string;
  }) {
    await prisma.auditLog.create({
      data: {
        staffId: params.staffId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        meta: (params.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: params.ip,
      },
    });
  }
}
