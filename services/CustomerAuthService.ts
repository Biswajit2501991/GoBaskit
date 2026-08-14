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
    // Source of truth includes VERIFIED rows + flag heal (permanent until admin delete).
    const isWhatsappVerified = await WhatsAppVerificationService.isMobileVerified(mobileE164);

    return {
      hasPassword,
      isLocked,
      isWhatsappVerified,
      failedAttempts,
      attemptsRemaining: Math.max(0, CUSTOMER_MAX_FAILED_LOGIN_ATTEMPTS - failedAttempts),
      /** Must verify on WhatsApp before setting a password when not yet verified, or when locked. */
      requiresWhatsApp: (!hasPassword && !isWhatsappVerified) || isLocked,
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

    if (!(await WhatsAppVerificationService.isMobileVerified(mobileE164))) {
      return {
        ok: false as const,
        code: 'VERIFICATION_REQUIRED' as const,
        error: 'Verify your WhatsApp number before signing in.',
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
   * Set or reset a customer password.
   * - Fresh WhatsApp proof (verificationId recently approved) → set or reset.
   * - Permanently verified number with no password yet → first password only
   *   (no re-verify until admin deletes the verification).
   * - Reset when a password already exists still requires fresh WhatsApp proof.
   */
  static async setPassword(params: {
    mobileE164: string;
    password: string;
    verificationId?: string;
  }) {
    const { mobileE164, password, verificationId } = params;

    let record = await this.findByMobileE164(mobileE164);
    const permanentlyVerified = await WhatsAppVerificationService.isMobileVerified(mobileE164);

    let allowed = false;
    if (verificationId) {
      // Allow a recently approved verification request (incl. delayed password form).
      const check = await WhatsAppVerificationService.getSessionVerification(
        verificationId,
        mobileE164,
        7 * 24 * 60 * 60 * 1000,
      );
      if (check.found && check.verified) {
        allowed = true;
      }
    }
    // First password on a permanently verified number — do not ask WhatsApp again.
    if (!allowed && permanentlyVerified && !record?.passwordHash) {
      allowed = true;
    }
    if (!allowed) {
      throw new Error('WhatsApp verification required before setting your password');
    }

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
