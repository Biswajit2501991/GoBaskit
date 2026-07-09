import type { Coupon, CouponDiscountType, OrderDiscountType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';
import { SettingsService, type DiscountConfig } from '@/services/SettingsService';
import { ActionPlusMembershipClient } from '@/services/ActionPlusMembershipClient';

export type DiscountApplyType = 'COUPON' | 'MEMBERSHIP';

export interface DiscountQuote {
  ok: true;
  type: DiscountApplyType;
  discountAmount: number;
  couponCode?: string;
  couponId?: string;
  memberId?: string | null;
  message: string;
  youSavedLabel: string;
}

export interface DiscountError {
  ok: false;
  code: string;
  error: string;
}

export type DiscountResult = DiscountQuote | DiscountError;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeCouponAmount(
  coupon: Pick<Coupon, 'discountType' | 'discountValue' | 'maxDiscount'>,
  subtotal: number,
): number {
  let amount = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    amount = (subtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount != null && coupon.maxDiscount > 0) {
      amount = Math.min(amount, coupon.maxDiscount);
    }
  } else {
    amount = coupon.discountValue;
  }
  amount = Math.min(amount, subtotal);
  return roundMoney(Math.max(0, amount));
}

function computeMembershipAmount(cfg: DiscountConfig['membership'], subtotal: number): number {
  let amount = (subtotal * cfg.discountPercent) / 100;
  if (cfg.maxDiscount != null && cfg.maxDiscount > 0) {
    amount = Math.min(amount, cfg.maxDiscount);
  }
  amount = Math.min(amount, subtotal);
  return roundMoney(Math.max(0, amount));
}

function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export class DiscountEngine {
  static async getPublicConfig() {
    const config = await SettingsService.getStoreConfig();
    const d = config.discountConfig;
    return {
      couponsEnabled: d.couponsEnabled,
      membershipEnabled: d.membershipEnabled && d.membership.enabled,
      membershipMessage: d.membership.message,
      membershipDiscountPercent: d.membership.discountPercent,
    };
  }

  static async validateCoupon(params: {
    code: string;
    subtotal: number;
    mobile?: string | null;
  }): Promise<DiscountResult> {
    const config = await SettingsService.getStoreConfig();
    if (!config.discountConfig.couponsEnabled) {
      return { ok: false, code: 'DISABLED', error: 'Coupon system is disabled' };
    }

    const code = normalizeCouponCode(params.code);
    if (!code) {
      return { ok: false, code: 'INVALID', error: 'Invalid Coupon Code' };
    }

    const subtotal = Number(params.subtotal);
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return { ok: false, code: 'EMPTY_CART', error: 'Cart is empty' };
    }

    const coupon = await prisma.coupon.findUnique({ where: { couponCode: code } });
    if (!coupon) {
      return { ok: false, code: 'INVALID', error: 'Invalid Coupon Code' };
    }
    if (coupon.status !== 'ACTIVE') {
      return { ok: false, code: 'INACTIVE', error: 'Coupon is not active' };
    }

    const now = new Date();
    if (coupon.startDate && coupon.startDate > now) {
      return { ok: false, code: 'NOT_STARTED', error: 'Coupon is not yet valid' };
    }
    if (coupon.expiryDate && coupon.expiryDate < now) {
      return { ok: false, code: 'EXPIRED', error: 'Coupon Expired' };
    }
    if (coupon.minimumOrder > 0 && subtotal < coupon.minimumOrder) {
      return {
        ok: false,
        code: 'MIN_ORDER',
        error: `Minimum order of ₹${coupon.minimumOrder} required`,
      };
    }

    if (coupon.totalUsageLimit != null) {
      const totalUsed = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
      if (totalUsed >= coupon.totalUsageLimit) {
        return { ok: false, code: 'TOTAL_LIMIT', error: 'Coupon Usage Limit Reached' };
      }
    }

    const mobile = params.mobile ? normalizeMobile(params.mobile) : '';
    if (mobile && isValidIndianMobile(mobile)) {
      const usedByMobile = await prisma.couponUsage.count({
        where: { couponId: coupon.id, mobile },
      });
      if (usedByMobile >= coupon.usageLimitPerMobile) {
        return { ok: false, code: 'MOBILE_LIMIT', error: 'Coupon Usage Limit Reached' };
      }
    }

    const discountAmount = computeCouponAmount(coupon, subtotal);
    if (discountAmount <= 0) {
      return { ok: false, code: 'ZERO', error: 'Coupon does not apply to this cart' };
    }

    return {
      ok: true,
      type: 'COUPON',
      discountAmount,
      couponCode: coupon.couponCode,
      couponId: coupon.id,
      message: 'Coupon Applied Successfully',
      youSavedLabel: `You Saved ₹${discountAmount}`,
    };
  }

  static async checkMembership(params: {
    mobile: string;
    subtotal: number;
  }): Promise<DiscountResult> {
    const config = await SettingsService.getStoreConfig();
    const mem = config.discountConfig.membership;
    if (!config.discountConfig.membershipEnabled || !mem.enabled) {
      return { ok: false, code: 'DISABLED', error: 'Membership discount is disabled' };
    }

    const mobile = normalizeMobile(params.mobile);
    if (!isValidIndianMobile(mobile)) {
      return { ok: false, code: 'INVALID_MOBILE', error: 'Enter a valid 10-digit mobile number' };
    }

    const subtotal = Number(params.subtotal);
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return { ok: false, code: 'EMPTY_CART', error: 'Cart is empty' };
    }
    if (mem.minimumOrder > 0 && subtotal < mem.minimumOrder) {
      return {
        ok: false,
        code: 'MIN_ORDER',
        error: `Minimum order of ₹${mem.minimumOrder} required for membership discount`,
      };
    }

    const status = await ActionPlusMembershipClient.getMemberStatus(mobile);
    if (!status.isActive) {
      if (status.error === 'Membership service not configured') {
        return { ok: false, code: 'NOT_CONFIGURED', error: 'Membership service unavailable' };
      }
      if (
        status.error === 'Membership service unauthorized' ||
        status.error === 'Membership service endpoint missing' ||
        status.error === 'Membership service unavailable' ||
        status.error === 'Membership lookup failed'
      ) {
        return { ok: false, code: 'SERVICE_ERROR', error: 'Membership service unavailable' };
      }
      return {
        ok: false,
        code: 'INACTIVE_MEMBER',
        error: 'No Active Membership Found',
      };
    }

    const used = await prisma.membershipDiscountUsage.count({ where: { mobile } });
    if (used >= mem.usageLimitPerMember) {
      return {
        ok: false,
        code: 'MEMBER_LIMIT',
        error: 'Membership discount usage limit reached',
      };
    }

    const discountAmount = computeMembershipAmount(mem, subtotal);
    if (discountAmount <= 0) {
      return { ok: false, code: 'ZERO', error: 'Membership discount does not apply' };
    }

    return {
      ok: true,
      type: 'MEMBERSHIP',
      discountAmount,
      memberId: status.memberId,
      message: mem.message || 'Action Plus Membership Discount Applied',
      youSavedLabel: `You saved ₹${discountAmount}`,
    };
  }

  /**
   * Re-validate a client-requested discount at checkout. Never trusts client amounts.
   */
  static async resolveForCheckout(params: {
    type: 'NONE' | 'COUPON' | 'MEMBERSHIP';
    couponCode?: string | null;
    mobile: string;
    subtotal: number;
    clientDiscountAmount?: number | null;
  }): Promise<
    | { ok: true; discountType: OrderDiscountType; discountAmount: number; couponCode: string | null; couponId: string | null; memberId: string | null }
    | { ok: false; error: string }
  > {
    if (params.type === 'NONE' || !params.type) {
      return {
        ok: true,
        discountType: 'NONE',
        discountAmount: 0,
        couponCode: null,
        couponId: null,
        memberId: null,
      };
    }

    if (params.type === 'COUPON') {
      const result = await this.validateCoupon({
        code: params.couponCode || '',
        subtotal: params.subtotal,
        mobile: params.mobile,
      });
      if (!result.ok) return { ok: false, error: result.error };
      if (
        params.clientDiscountAmount != null &&
        Math.abs(params.clientDiscountAmount - result.discountAmount) > 0.05
      ) {
        return { ok: false, error: 'Discount amount mismatch — please re-apply your coupon' };
      }
      return {
        ok: true,
        discountType: 'COUPON',
        discountAmount: result.discountAmount,
        couponCode: result.couponCode ?? null,
        couponId: result.couponId ?? null,
        memberId: null,
      };
    }

    if (params.type === 'MEMBERSHIP') {
      const result = await this.checkMembership({
        mobile: params.mobile,
        subtotal: params.subtotal,
      });
      if (!result.ok) return { ok: false, error: result.error };
      if (
        params.clientDiscountAmount != null &&
        Math.abs(params.clientDiscountAmount - result.discountAmount) > 0.05
      ) {
        return { ok: false, error: 'Discount amount mismatch — please re-check membership' };
      }
      return {
        ok: true,
        discountType: 'MEMBERSHIP',
        discountAmount: result.discountAmount,
        couponCode: null,
        couponId: null,
        memberId: result.memberId ?? null,
      };
    }

    return { ok: false, error: 'Invalid discount type' };
  }

  static async recordCheckoutDiscount(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      mobile: string;
      discountType: OrderDiscountType;
      discountAmount: number;
      couponId: string | null;
      couponCode: string | null;
      memberId: string | null;
    },
  ) {
    const mobile = normalizeMobile(params.mobile);
    if (params.discountType === 'COUPON' && params.couponId) {
      await tx.couponUsage.create({
        data: {
          couponId: params.couponId,
          mobile,
          orderId: params.orderId,
          discountAmount: params.discountAmount,
        },
      });
    }
    if (params.discountType === 'MEMBERSHIP') {
      await tx.membershipDiscountUsage.create({
        data: {
          mobile,
          memberId: params.memberId,
          orderId: params.orderId,
          discountAmount: params.discountAmount,
        },
      });
    }
    await tx.discountLog.create({
      data: {
        orderId: params.orderId,
        mobile,
        couponCode: params.couponCode,
        membership: params.discountType === 'MEMBERSHIP',
        discountAmount: params.discountAmount,
        discountType: params.discountType,
        status: 'APPLIED',
        appliedBy: 'checkout',
      },
    });
  }

  static async logAttempt(params: {
    mobile?: string | null;
    couponCode?: string | null;
    membership?: boolean;
    discountAmount?: number;
    discountType?: OrderDiscountType;
    status: string;
    appliedBy?: string;
    meta?: Record<string, unknown>;
  }) {
    await prisma.discountLog.create({
      data: {
        mobile: params.mobile ? normalizeMobile(params.mobile) : null,
        couponCode: params.couponCode ?? null,
        membership: params.membership ?? false,
        discountAmount: params.discountAmount ?? 0,
        discountType: params.discountType ?? 'NONE',
        status: params.status,
        appliedBy: params.appliedBy ?? 'customer',
        meta: (params.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    }).catch(() => null);
  }
}

export type { CouponDiscountType };
