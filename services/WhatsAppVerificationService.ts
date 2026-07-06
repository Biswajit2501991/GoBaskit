import { prisma } from '@/lib/prisma';
import type { WhatsAppVerificationStatus } from '@prisma/client';
import {
  VERIFICATION_CODE_PREFIX,
  VERIFICATION_CODE_TTL_MINUTES,
  VERIFICATION_MAX_ATTEMPTS_PER_DAY,
  VERIFICATION_AUDIT_ACTIONS,
} from '@/constants/whatsappVerification';
import { VerificationAuditService } from '@/services/VerificationAuditService';
import { CustomerOrderService } from '@/services/CustomerOrderService';
import { SettingsService } from '@/services/SettingsService';
import { WHATSAPP_NUMBER } from '@/constants';
import { buildWhatsAppUrl } from '@/utils/whatsapp';
import { e164ToCheckoutMobile, isValidE164, mobileVariantsFromE164 } from '@/utils/phone';
import { adminEventBus } from '@/lib/realtime/eventBus';

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function generateVerificationCode(): string {
  const digits = String(Math.floor(100000 + Math.random() * 900000));
  return `${VERIFICATION_CODE_PREFIX}-${digits}`;
}

function buildVerificationMessage(code: string, mobile: string): string {
  return [
    'Hi Go Baskit,',
    '',
    'Please verify my WhatsApp.',
    '',
    'Verification Code:',
    code,
    '',
    'Mobile:',
    mobile,
  ].join('\n');
}

export class WhatsAppVerificationService {
  static async expireStalePending() {
    const now = new Date();
    const expired = await prisma.whatsAppVerification.findMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      select: { id: true, mobile: true },
    });

    if (expired.length === 0) return;

    await prisma.whatsAppVerification.updateMany({
      where: { id: { in: expired.map((e) => e.id) } },
      data: { status: 'EXPIRED' },
    });

    for (const row of expired) {
      await VerificationAuditService.log({
        action: VERIFICATION_AUDIT_ACTIONS.EXPIRED,
        mobile: row.mobile,
        verificationId: row.id,
        actorType: 'system',
      });
    }
  }

  static async getBusinessWhatsAppNumber(): Promise<string> {
    const config = await SettingsService.getStoreConfig();
    return config.whatsappNumber || WHATSAPP_NUMBER;
  }

  static async isMobileVerified(mobileE164: string): Promise<boolean> {
    if (!isValidE164(mobileE164)) return false;
    const record = await prisma.customerMobile.findUnique({
      where: { mobile: mobileE164 },
      select: { isWhatsappVerified: true },
    });
    return record?.isWhatsappVerified === true;
  }

  static async needsVerification(mobileE164: string): Promise<boolean> {
    if (!isValidE164(mobileE164)) return true;
    if (await this.isMobileVerified(mobileE164)) return false;

    const checkoutMobile = e164ToCheckoutMobile(mobileE164);
    const orderCount = await CustomerOrderService.orderCountForMobile(checkoutMobile);
    return orderCount === 0;
  }

  static async countAttemptsToday(mobileE164: string): Promise<number> {
    return prisma.whatsAppVerification.count({
      where: {
        mobile: mobileE164,
        createdAt: { gte: startOfDay() },
      },
    });
  }

  static async getOrCreateVerification(params: {
    mobileE164: string;
    customerName?: string;
    forceNew?: boolean;
    ip?: string;
    userAgent?: string;
  }) {
    const { mobileE164, customerName, forceNew, ip, userAgent } = params;
    if (!isValidE164(mobileE164)) {
      throw new Error('Enter a valid mobile number with country code');
    }

    await this.expireStalePending();

    if (await this.isMobileVerified(mobileE164)) {
      return {
        verified: true,
        mobile: mobileE164,
        verification: null,
        whatsappUrl: null,
      };
    }

    const attempts = await this.countAttemptsToday(mobileE164);
    if (attempts >= VERIFICATION_MAX_ATTEMPTS_PER_DAY) {
      throw new Error('Maximum verification attempts reached for today. Please try again tomorrow.');
    }

    const now = new Date();

    if (forceNew) {
      await prisma.whatsAppVerification.updateMany({
        where: { mobile: mobileE164, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
    }

    const existing = await prisma.whatsAppVerification.findFirst({
      where: {
        mobile: mobileE164,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const businessNumber = await this.getBusinessWhatsAppNumber();
      const whatsappUrl = buildWhatsAppUrl(
        businessNumber,
        buildVerificationMessage(existing.verificationCode, mobileE164),
      );
      return {
        verified: false,
        mobile: mobileE164,
        verification: this.serializeVerification(existing),
        whatsappUrl,
      };
    }

    const customerMobile = await prisma.customerMobile.upsert({
      where: { mobile: mobileE164 },
      create: { mobile: mobileE164 },
      update: {},
    });

    const verification = await prisma.whatsAppVerification.create({
      data: {
        customerMobileId: customerMobile.id,
        mobile: mobileE164,
        verificationCode: generateVerificationCode(),
        status: 'PENDING',
        customerName: customerName?.trim() || null,
        expiresAt: addMinutes(now, VERIFICATION_CODE_TTL_MINUTES),
      },
    });

    await VerificationAuditService.log({
      action: VERIFICATION_AUDIT_ACTIONS.GENERATED,
      mobile: mobileE164,
      verificationId: verification.id,
      actorType: 'customer',
      ip,
      userAgent,
      meta: { code: verification.verificationCode },
    });

    const businessNumber = await this.getBusinessWhatsAppNumber();
    const whatsappUrl = buildWhatsAppUrl(
      businessNumber,
      buildVerificationMessage(verification.verificationCode, mobileE164),
    );

    return {
      verified: false,
      mobile: mobileE164,
      verification: this.serializeVerification(verification),
      whatsappUrl,
    };
  }

  static async getStatus(mobileE164: string) {
    if (!isValidE164(mobileE164)) {
      throw new Error('Invalid mobile number');
    }

    await this.expireStalePending();

    const verified = await this.isMobileVerified(mobileE164);
    const needsVerification = verified ? false : await this.needsVerification(mobileE164);

    const pending = await prisma.whatsAppVerification.findFirst({
      where: {
        mobile: mobileE164,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      mobile: mobileE164,
      verified,
      needsVerification,
      verification: pending ? this.serializeVerification(pending) : null,
    };
  }

  static async logWhatsAppOpened(params: {
    mobileE164: string;
    verificationId?: string;
    ip?: string;
    userAgent?: string;
  }) {
    await VerificationAuditService.log({
      action: VERIFICATION_AUDIT_ACTIONS.WHATSAPP_OPENED,
      mobile: params.mobileE164,
      verificationId: params.verificationId,
      actorType: 'customer',
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  static async logSentAck(params: {
    mobileE164: string;
    verificationId?: string;
    ip?: string;
    userAgent?: string;
  }) {
    await VerificationAuditService.log({
      action: VERIFICATION_AUDIT_ACTIONS.SENT_ACK,
      mobile: params.mobileE164,
      verificationId: params.verificationId,
      actorType: 'customer',
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  static async approve(verificationId: string, staffId: string, ip?: string) {
    await this.expireStalePending();

    const verification = await prisma.whatsAppVerification.findUnique({
      where: { id: verificationId },
      include: { customerMobile: true },
    });

    if (!verification) throw new Error('Verification request not found');
    if (verification.status === 'VERIFIED') throw new Error('Already verified');
    if (verification.status !== 'PENDING') {
      throw new Error(`Cannot verify — status is ${verification.status}`);
    }
    if (verification.expiresAt < new Date()) {
      await prisma.whatsAppVerification.update({
        where: { id: verificationId },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Verification code has expired');
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.whatsAppVerification.update({
        where: { id: verificationId },
        data: {
          status: 'VERIFIED',
          verifiedAt: now,
          verifiedById: staffId,
        },
      });

      await tx.customerMobile.update({
        where: { id: verification.customerMobileId },
        data: {
          isWhatsappVerified: true,
          verifiedAt: now,
          verifiedById: staffId,
        },
      });

      const checkoutMobile = e164ToCheckoutMobile(verification.mobile);
      const variants = mobileVariantsFromE164(verification.mobile);
      await tx.customer.updateMany({
        where: { mobile: { in: variants } },
        data: {
          isWhatsappVerified: true,
          verifiedAt: now,
          verifiedById: staffId,
        },
      });

      await tx.whatsAppVerification.updateMany({
        where: {
          mobile: verification.mobile,
          status: 'PENDING',
          id: { not: verificationId },
        },
        data: { status: 'EXPIRED' },
      });
    });

    await VerificationAuditService.log({
      action: VERIFICATION_AUDIT_ACTIONS.APPROVED,
      mobile: verification.mobile,
      verificationId,
      actorType: 'staff',
      actorId: staffId,
      ip,
    });

    adminEventBus.emit({
      type: 'whatsapp_verification_updated',
      payload: { id: verificationId, status: 'VERIFIED', mobile: verification.mobile },
    });

    return this.getStatus(verification.mobile);
  }

  static async reject(verificationId: string, staffId: string, ip?: string) {
    const verification = await prisma.whatsAppVerification.findUnique({
      where: { id: verificationId },
    });
    if (!verification) throw new Error('Verification request not found');
    if (verification.status !== 'PENDING') {
      throw new Error(`Cannot reject — status is ${verification.status}`);
    }

    await prisma.whatsAppVerification.update({
      where: { id: verificationId },
      data: { status: 'REJECTED', verifiedById: staffId },
    });

    await VerificationAuditService.log({
      action: VERIFICATION_AUDIT_ACTIONS.REJECTED,
      mobile: verification.mobile,
      verificationId,
      actorType: 'staff',
      actorId: staffId,
      ip,
    });

    adminEventBus.emit({
      type: 'whatsapp_verification_updated',
      payload: { id: verificationId, status: 'REJECTED', mobile: verification.mobile },
    });

    return { id: verificationId, status: 'REJECTED' as WhatsAppVerificationStatus };
  }

  static async listAdmin(params: {
    search?: string;
    status?: WhatsAppVerificationStatus;
    page?: number;
    pageSize?: number;
  }) {
    await this.expireStalePending();

    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: {
      status?: WhatsAppVerificationStatus;
      OR?: Array<Record<string, unknown>>;
    } = {};

    if (params.status) where.status = params.status;

    const q = params.search?.trim();
    if (q) {
      where.OR = [
        { mobile: { contains: q } },
        { verificationCode: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total, pendingCount] = await Promise.all([
      prisma.whatsAppVerification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          verifiedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.whatsAppVerification.count({ where }),
      prisma.whatsAppVerification.count({ where: { status: 'PENDING', expiresAt: { gt: new Date() } } }),
    ]);

    return {
      items: items.map((v) => ({
        ...this.serializeVerification(v),
        customerName: v.customerName,
        verifiedBy: v.verifiedBy,
      })),
      total,
      page,
      pageSize,
      pendingCount,
    };
  }

  static async getPendingCount(): Promise<number> {
    await this.expireStalePending();
    return prisma.whatsAppVerification.count({
      where: { status: 'PENDING', expiresAt: { gt: new Date() } },
    });
  }

  static async invalidateVerificationForMobileChange(oldMobileE164: string) {
    if (!isValidE164(oldMobileE164)) return;
    await prisma.customerMobile.updateMany({
      where: { mobile: oldMobileE164 },
      data: { isWhatsappVerified: false, verifiedAt: null, verifiedById: null },
    });
  }

  private static serializeVerification(v: {
    id: string;
    mobile: string;
    verificationCode: string;
    status: WhatsAppVerificationStatus;
    createdAt: Date;
    expiresAt: Date;
    verifiedAt: Date | null;
  }) {
    return {
      id: v.id,
      mobile: v.mobile,
      verificationCode: v.verificationCode,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      expiresAt: v.expiresAt.toISOString(),
      verifiedAt: v.verifiedAt?.toISOString() ?? null,
    };
  }
}
