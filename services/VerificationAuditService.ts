import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export class VerificationAuditService {
  static async log(params: {
    action: string;
    mobile?: string;
    verificationId?: string;
    actorType: 'customer' | 'staff' | 'system';
    actorId?: string;
    ip?: string;
    userAgent?: string;
    meta?: Record<string, unknown>;
  }) {
    await prisma.verificationAuditLog.create({
      data: {
        action: params.action,
        mobile: params.mobile,
        verificationId: params.verificationId,
        actorType: params.actorType,
        actorId: params.actorId,
        ip: params.ip,
        userAgent: params.userAgent,
        meta: (params.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
