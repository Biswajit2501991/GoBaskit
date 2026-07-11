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
  private static lastExpireAt = 0;
  private static readonly EXPIRE_THROTTLE_MS = 5 * 60 * 1000;

  static async expireStalePending(force = false) {
    const nowMs = Date.now();
    if (!force && nowMs - this.lastExpireAt < this.EXPIRE_THROTTLE_MS) {
      return;
    }
    this.lastExpireAt = nowMs;

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

    // Batch audit writes instead of sequential awaits
    await Promise.all(
      expired.map((row) =>
        VerificationAuditService.log({
          action: VERIFICATION_AUDIT_ACTIONS.EXPIRED,
          mobile: row.mobile,
          verificationId: row.id,
          actorType: 'system',
        }),
      ),
    );
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
    const state = await this.getCheckoutVerificationState(mobileE164);
    return state.needsVerification;
  }

  /** Single-pass verification state for checkout (avoids duplicate DB reads). */
  static async getCheckoutVerificationState(mobileE164: string): Promise<{
    needsVerification: boolean;
    isVerified: boolean;
    canCheckout: boolean;
    messageSent: boolean;
  }> {
    if (!isValidE164(mobileE164)) {
      return { needsVerification: true, isVerified: false, canCheckout: false, messageSent: false };
    }
    const isVerified = await this.isMobileVerified(mobileE164);
    if (isVerified) {
      return { needsVerification: false, isVerified: true, canCheckout: true, messageSent: false };
    }

    const checkoutMobile = e164ToCheckoutMobile(mobileE164);
    const orderCount = checkoutMobile
      ? await CustomerOrderService.completedOrderCountForMobile(checkoutMobile)
      : 0;
    if (orderCount > 0) {
      return { needsVerification: false, isVerified: false, canCheckout: true, messageSent: false };
    }

    const messageSent = await this.hasSentAcknowledgement(mobileE164);
    return {
      needsVerification: true,
      isVerified: false,
      canCheckout: messageSent,
      messageSent,
    };
  }

  static async hasSentAcknowledgement(mobileE164: string): Promise<boolean> {
    const variants = mobileVariantsFromE164(mobileE164);
    const pending = await prisma.whatsAppVerification.findFirst({
      where: {
        mobile: { in: variants },
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        sentAcknowledgedAt: { not: null },
      },
      select: { id: true },
    });
    return Boolean(pending);
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
    /**
     * Login/session verification. When true, a fresh ownership proof is always
     * required — the permanent "already verified" flag can NOT short-circuit it.
     * This is what prevents someone from logging in on a new device just because
     * the number was verified once in the past.
     */
    requireFresh?: boolean;
    ip?: string;
    userAgent?: string;
  }) {
    const { mobileE164, customerName, forceNew, requireFresh, ip, userAgent } = params;
    if (!isValidE164(mobileE164)) {
      throw new Error('Enter a valid mobile number with country code');
    }

    await this.expireStalePending();

    if (!requireFresh && (await this.isMobileVerified(mobileE164))) {
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

  static async getStatus(mobileE164: string, verificationId?: string) {
    if (!isValidE164(mobileE164)) {
      throw new Error('Invalid mobile number');
    }

    // Fast client-poll path: one indexed row read for the verification this browser started.
    // Skips expire sweep + checkout eligibility work so login can poll frequently.
    if (verificationId) {
      const v = await prisma.whatsAppVerification.findUnique({
        where: { id: verificationId },
      });
      const variants = mobileVariantsFromE164(mobileE164);
      if (!v || (!variants.includes(v.mobile) && v.mobile !== mobileE164)) {
        return {
          mobile: mobileE164,
          verified: false,
          needsVerification: true,
          canCheckout: false,
          messageSent: false,
          verification: null,
        };
      }

      const verified = v.status === 'VERIFIED';
      return {
        mobile: mobileE164,
        verified,
        needsVerification: !verified,
        canCheckout: verified || Boolean(v.sentAcknowledgedAt),
        messageSent: Boolean(v.sentAcknowledgedAt),
        verification: this.serializeVerification(v),
      };
    }

    await this.expireStalePending();

    const state = await this.getCheckoutVerificationState(mobileE164);
    const variants = mobileVariantsFromE164(mobileE164);

    const pending = await prisma.whatsAppVerification.findFirst({
      where: {
        mobile: { in: variants },
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      mobile: mobileE164,
      verified: state.isVerified,
      needsVerification: state.needsVerification,
      canCheckout: state.canCheckout,
      messageSent: state.messageSent,
      verification: pending ? this.serializeVerification(pending) : null,
    };
  }

  /**
   * Validates a verification for issuing a login session. The caller must hold
   * the verificationId returned when the code was generated (only the browser
   * that started the flow knows it), and it must have been freshly approved by
   * an admin for the same number. This binds the session to a genuine, recent
   * ownership proof rather than the permanent "verified once" flag.
   */
  static async getSessionVerification(
    verificationId: string,
    mobileE164: string,
    maxAgeMs = 60 * 60 * 1000,
  ): Promise<{ found: boolean; verified: boolean; status?: WhatsAppVerificationStatus }> {
    const v = await prisma.whatsAppVerification.findUnique({
      where: { id: verificationId },
      select: { mobile: true, status: true, verifiedAt: true },
    });
    if (!v || v.mobile !== mobileE164) return { found: false, verified: false };

    const fresh =
      v.status === 'VERIFIED' &&
      !!v.verifiedAt &&
      Date.now() - v.verifiedAt.getTime() <= maxAgeMs;

    return { found: true, verified: fresh, status: v.status };
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
    const now = new Date();
    const variants = mobileVariantsFromE164(params.mobileE164);

    if (params.verificationId) {
      await prisma.whatsAppVerification.updateMany({
        where: {
          id: params.verificationId,
          mobile: { in: variants },
          status: 'PENDING',
        },
        data: { sentAcknowledgedAt: now },
      });
    } else {
      const pending = await prisma.whatsAppVerification.findFirst({
        where: {
          mobile: { in: variants },
          status: 'PENDING',
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (pending) {
        await prisma.whatsAppVerification.update({
          where: { id: pending.id },
          data: { sentAcknowledgedAt: now },
        });
      }
    }

    await VerificationAuditService.log({
      action: VERIFICATION_AUDIT_ACTIONS.SENT_ACK,
      mobile: params.mobileE164,
      verificationId: params.verificationId,
      actorType: 'customer',
      ip: params.ip,
      userAgent: params.userAgent,
    });

    return this.getStatus(params.mobileE164);
  }

  /** Extract GB-###### from inbound WhatsApp text. */
  static extractVerificationCode(text: string): string | null {
    const re = new RegExp(`\\b${VERIFICATION_CODE_PREFIX}-?(\\d{6})\\b`, 'i');
    const match = text.match(re);
    if (!match?.[1]) return null;
    return `${VERIFICATION_CODE_PREFIX}-${match[1]}`;
  }

  /** Meta Cloud API sends `from` as digits without +. */
  static normalizeInboundWaPhone(from: string): string | null {
    const digits = from.replace(/\D/g, '');
    if (!digits || digits.length < 8) return null;
    const e164 = `+${digits}`;
    return isValidE164(e164) ? e164 : null;
  }

  /**
   * Auto-approve a PENDING verification when inbound WhatsApp text contains
   * a matching code AND the sender number matches the verification mobile.
   */
  static async tryAutoApproveFromInbound(params: {
    senderFrom: string;
    messageBody: string;
    waMessageId?: string;
  }): Promise<'approved' | 'already_verified' | 'no_match' | 'expired'> {
    await this.expireStalePending();

    const code = this.extractVerificationCode(params.messageBody);
    const senderE164 = this.normalizeInboundWaPhone(params.senderFrom);
    if (!code || !senderE164) return 'no_match';

    const senderVariants = mobileVariantsFromE164(senderE164);
    const verification = await prisma.whatsAppVerification.findFirst({
      where: {
        verificationCode: code,
        mobile: { in: senderVariants },
        status: { in: ['PENDING', 'VERIFIED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      await VerificationAuditService.log({
        action: 'verification_webhook_no_match',
        mobile: senderE164,
        actorType: 'system',
        meta: {
          code,
          waMessageId: params.waMessageId,
          reason: 'no_pending_or_verified_row',
        },
      });
      return 'no_match';
    }

    if (verification.status === 'VERIFIED') return 'already_verified';

    if (verification.expiresAt < new Date()) {
      await prisma.whatsAppVerification.update({
        where: { id: verification.id },
        data: { status: 'EXPIRED' },
      });
      await VerificationAuditService.log({
        action: VERIFICATION_AUDIT_ACTIONS.EXPIRED,
        mobile: verification.mobile,
        verificationId: verification.id,
        actorType: 'system',
        meta: { waMessageId: params.waMessageId, source: 'webhook' },
      });
      return 'expired';
    }

    await this.finalizeApproval(verification.id, {
      actorType: 'system',
      meta: { waMessageId: params.waMessageId, source: 'whatsapp_webhook' },
    });
    return 'approved';
  }

  static async approve(verificationId: string, staffId: string, ip?: string) {
    return this.finalizeApproval(verificationId, {
      actorType: 'staff',
      actorId: staffId,
      ip,
    });
  }

  /** System auto-approve (webhook). Idempotent if already verified. */
  static async approveFromWebhook(verificationId: string, meta?: Record<string, unknown>) {
    const existing = await prisma.whatsAppVerification.findUnique({
      where: { id: verificationId },
      select: { status: true, mobile: true },
    });
    if (!existing) throw new Error('Verification request not found');
    if (existing.status === 'VERIFIED') return this.getStatus(existing.mobile);
    return this.finalizeApproval(verificationId, {
      actorType: 'system',
      meta: { ...meta, source: 'whatsapp_webhook' },
    });
  }

  private static async finalizeApproval(
    verificationId: string,
    actor: {
      actorType: 'staff' | 'system';
      actorId?: string;
      ip?: string;
      meta?: Record<string, unknown>;
    },
  ) {
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
    const staffId = actor.actorType === 'staff' ? actor.actorId ?? null : null;

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
      actorType: actor.actorType,
      actorId: actor.actorId,
      ip: actor.ip,
      meta: actor.meta,
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

  /**
   * Admin deletes a verification row and clears permanent WhatsApp-verified flags
   * for that mobile so the customer can re-verify from scratch.
   */
  static async deleteVerification(verificationId: string, staffId: string, ip?: string) {
    const verification = await prisma.whatsAppVerification.findUnique({
      where: { id: verificationId },
    });
    if (!verification) throw new Error('Verification request not found');

    const mobile = verification.mobile;
    const variants = mobileVariantsFromE164(mobile);

    await prisma.$transaction(async (tx) => {
      await tx.whatsAppVerification.delete({ where: { id: verificationId } });

      await tx.customerMobile.updateMany({
        where: { mobile: { in: variants } },
        data: {
          isWhatsappVerified: false,
          verifiedAt: null,
          verifiedById: null,
        },
      });

      await tx.customer.updateMany({
        where: { mobile: { in: variants } },
        data: {
          isWhatsappVerified: false,
          verifiedAt: null,
          verifiedById: null,
        },
      });
    });

    await VerificationAuditService.log({
      action: VERIFICATION_AUDIT_ACTIONS.DELETED,
      mobile,
      verificationId,
      actorType: 'staff',
      actorId: staffId,
      ip,
      meta: { previousStatus: verification.status },
    });

    adminEventBus.emit({
      type: 'whatsapp_verification_updated',
      payload: { id: verificationId, status: 'DELETED', mobile },
    });

    return { id: verificationId, deleted: true as const, mobile };
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
    // Throttled expiry — count itself stays a cheap query.
    void this.expireStalePending();
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
    sentAcknowledgedAt?: Date | null;
  }) {
    return {
      id: v.id,
      mobile: v.mobile,
      verificationCode: v.verificationCode,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      expiresAt: v.expiresAt.toISOString(),
      verifiedAt: v.verifiedAt?.toISOString() ?? null,
      sentAcknowledgedAt: v.sentAcknowledgedAt?.toISOString() ?? null,
    };
  }
}
