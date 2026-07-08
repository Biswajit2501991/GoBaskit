import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { e164ToCheckoutMobile, isValidE164, mobileVariantsFromE164 } from '@/utils/phone';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';

/** Lock the account after this many consecutive wrong passwords. */
export const CUSTOMER_MAX_FAILED_LOGIN_ATTEMPTS = 3;

export class CustomerAuthService {
  static async findByMobileE164(mobileE164: string) {
    if (!isValidE164(mobileE164)) return null;
    const variants = mobileVariantsFromE164(mobileE164);
    return prisma.customerMobile.findFirst({
      where: { mobile: { in: variants } },
    });
  }

  static isLocked(record: { failedLoginAttempts: number }): boolean {
    return record.failedLoginAttempts >= CUSTOMER_MAX_FAILED_LOGIN_ATTEMPTS;
  }

  static async getAuthStatus(mobileE164: string) {
    const record = await this.findByMobileE164(mobileE164);
    const hasPassword = Boolean(record?.passwordHash);
    const failedAttempts = record?.failedLoginAttempts ?? 0;
    const isLocked = record ? this.isLocked(record) : false;

    return {
      hasPassword,
      isLocked,
      isWhatsappVerified: record?.isWhatsappVerified ?? false,
      failedAttempts,
      attemptsRemaining: Math.max(0, CUSTOMER_MAX_FAILED_LOGIN_ATTEMPTS - failedAttempts),
      /** Must verify on WhatsApp before setting / resetting a password. */
      requiresWhatsApp: !hasPassword || isLocked,
    };
  }

  static async login(mobileE164: string, password: string) {
    const record = await this.findByMobileE164(mobileE164);
    if (!record?.passwordHash) {
      return {
        ok: false as const,
        code: 'NO_PASSWORD' as const,
        error: 'No password set. Verify via WhatsApp to create one.',
      };
    }

    if (this.isLocked(record)) {
      return {
        ok: false as const,
        code: 'LOCKED' as const,
        locked: true,
        error: 'Too many failed attempts. Verify via WhatsApp to reset your password.',
      };
    }

    const valid = await verifyPassword(password, record.passwordHash);
    if (!valid) {
      const failedAttempts = record.failedLoginAttempts + 1;
      const locked = failedAttempts >= CUSTOMER_MAX_FAILED_LOGIN_ATTEMPTS;
      await prisma.customerMobile.update({
        where: { id: record.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedAt: locked ? new Date() : record.lockedAt,
          // Clear password on lock so recovery always goes through WhatsApp + new password.
          ...(locked ? { passwordHash: null } : {}),
        },
      });

      if (locked) {
        return {
          ok: false as const,
          code: 'LOCKED' as const,
          locked: true,
          error: 'Too many failed attempts. Verify via WhatsApp to set a new password.',
        };
      }

      return {
        ok: false as const,
        code: 'INVALID_PASSWORD' as const,
        error: 'Incorrect password',
        attemptsRemaining: CUSTOMER_MAX_FAILED_LOGIN_ATTEMPTS - failedAttempts,
      };
    }

    await prisma.customerMobile.update({
      where: { id: record.id },
      data: { failedLoginAttempts: 0, lockedAt: null },
    });

    return { ok: true as const, mobile10: e164ToCheckoutMobile(mobileE164) };
  }

  /**
   * Set or reset a customer password. Requires a fresh, admin-approved WhatsApp
   * verification the caller initiated (verificationId).
   */
  static async setPassword(params: {
    mobileE164: string;
    password: string;
    verificationId: string;
  }) {
    const { mobileE164, password, verificationId } = params;

    const check = await WhatsAppVerificationService.getSessionVerification(
      verificationId,
      mobileE164,
    );
    if (!check.found || !check.verified) {
      throw new Error('WhatsApp verification required before setting your password');
    }

    let record = await this.findByMobileE164(mobileE164);
    if (!record) {
      record = await prisma.customerMobile.create({
        data: { mobile: mobileE164 },
      });
    }

    const passwordHash = await hashPassword(password);
    await prisma.customerMobile.update({
      where: { id: record.id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedAt: null,
      },
    });

    return { mobile10: e164ToCheckoutMobile(mobileE164) };
  }
}
