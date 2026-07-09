'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDiscountStore, type AppliedDiscount } from '@/store/discountStore';
import { useStaffPortalStore } from '@/store/staffPortalStore';
import { formatCurrency } from '@/utils/formatter';
import { normalizeMobile } from '@/utils/mobile';

interface PublicDiscountConfig {
  couponsEnabled: boolean;
  membershipEnabled: boolean;
  membershipMessage: string;
  membershipDiscountPercent: number;
}

interface CouponSectionProps {
  subtotal: number;
}

export default function CouponSection({ subtotal }: CouponSectionProps) {
  const applied = useDiscountStore((s) => s.applied);
  const setApplied = useDiscountStore((s) => s.setApplied);
  const clearDiscount = useDiscountStore((s) => s.clear);
  const customerMobile = useStaffPortalStore((s) => s.customerMobile);

  const [config, setConfig] = useState<PublicDiscountConfig | null>(null);
  const [code, setCode] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const autoCheckedRef = useRef(false);
  const staleClearedForRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/discount/config')
      .then((r) => r.json())
      .then((data: PublicDiscountConfig) => {
        if (alive) setConfig(data);
      })
      .catch(() => {
        if (alive) {
          setConfig({
            couponsEnabled: false,
            membershipEnabled: false,
            membershipMessage: '',
            membershipDiscountPercent: 0,
          });
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  // Drop stale quotes when cart subtotal changes (deferred to avoid sync setState-in-effect)
  useEffect(() => {
    if (!applied) {
      staleClearedForRef.current = null;
      return;
    }
    if (Math.abs(applied.quotedSubtotal - subtotal) <= 0.05) return;
    if (staleClearedForRef.current === subtotal) return;
    staleClearedForRef.current = subtotal;
    const timer = window.setTimeout(() => {
      clearDiscount();
      setInfo('Cart changed — please re-apply your discount');
      setError('');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [subtotal, applied, clearDiscount]);

  const applyQuote = useCallback(
    (quote: AppliedDiscount, replaceMessage?: string) => {
      setApplied(quote);
      setError('');
      setInfo(replaceMessage || quote.message);
      setCode('');
    },
    [setApplied],
  );

  const sessionMobile = customerMobile ? normalizeMobile(customerMobile) : '';

  const checkMembership = useCallback(
    async (mobile: string, opts?: { silent?: boolean; replaceCoupon?: boolean }) => {
      if (!config?.membershipEnabled || subtotal <= 0) return;
      const normalized = normalizeMobile(mobile);
      if (normalized.length !== 10) {
        if (!opts?.silent) setError('Enter a valid 10-digit mobile number');
        return;
      }

      if (applied?.type === 'COUPON' && !opts?.replaceCoupon) {
        setError('Remove coupon first to apply membership discount');
        return;
      }

      setBusy(true);
      setError('');
      try {
        const res = await fetch('/api/discount/membership/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: normalized, subtotal }),
        });
        const data = await res.json();
        if (!data.ok) {
          if (!opts?.silent) setError(data.error || 'No Active Membership Found');
          return;
        }
        applyQuote(
          {
            type: 'MEMBERSHIP',
            discountAmount: data.discountAmount,
            memberId: data.memberId ?? null,
            message: data.message,
            youSavedLabel: data.youSavedLabel,
            quotedSubtotal: subtotal,
          },
          applied?.type === 'COUPON'
            ? 'Coupon removed. Membership discount applied.'
            : data.message,
        );
      } catch {
        if (!opts?.silent) setError('Membership check failed. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [config?.membershipEnabled, subtotal, applied, applyQuote],
  );

  // Auto-check membership for logged-in customers (async fetch — not sync setState)
  useEffect(() => {
    if (!config?.membershipEnabled || !sessionMobile || applied) return;
    if (subtotal <= 0 || autoCheckedRef.current) return;
    autoCheckedRef.current = true;
    const timer = window.setTimeout(() => {
      void checkMembership(sessionMobile, { silent: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [config, sessionMobile, applied, subtotal, checkMembership]);

  async function applyCoupon() {
    if (!config?.couponsEnabled) return;
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter a coupon code');
      return;
    }
    if (applied?.type === 'MEMBERSHIP') {
      setError('Remove membership discount first to apply a coupon');
      return;
    }

    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/discount/coupon/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: trimmed,
          subtotal,
          mobile: sessionMobile || guestMobile || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Invalid Coupon Code');
        return;
      }
      applyQuote({
        type: 'COUPON',
        discountAmount: data.discountAmount,
        couponCode: data.couponCode,
        message: data.message,
        youSavedLabel: data.youSavedLabel,
        quotedSubtotal: subtotal,
      });
    } catch {
      setError('Could not validate coupon. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function removeDiscount() {
    clearDiscount();
    setError('');
    setInfo('');
    autoCheckedRef.current = false;
  }

  if (!config) return null;
  if (!config.couponsEnabled && !config.membershipEnabled) return null;

  return (
    <div className="space-y-3">
      {config.couponsEnabled && (
        <div className="rounded-xl border border-dashed border-blinkit-green/50 bg-[#E8F8EE] p-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-blinkit-green flex items-center justify-center shrink-0 text-white font-bold text-sm">
              %
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-gray-900">Apply Coupon Code</p>
              <p className="text-xs text-gray-500 mt-0.5">Enter code to get discount</p>
              {applied?.type === 'COUPON' ? (
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-blinkit-green">{applied.couponCode}</p>
                    <p className="text-xs text-blinkit-green">{applied.youSavedLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeDiscount}
                    className="text-xs font-medium text-red-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="mt-2.5 flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="bg-white h-10"
                    disabled={busy || applied?.type === 'MEMBERSHIP'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyCoupon();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={applyCoupon}
                    disabled={busy || applied?.type === 'MEMBERSHIP'}
                    className="shrink-0 px-5"
                  >
                    Apply
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {config.membershipEnabled && (
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 space-y-2">
          <p className="font-bold text-sm text-gray-900">Action Plus Membership</p>
          {applied?.type === 'MEMBERSHIP' ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blinkit-green">
                {applied.message || config.membershipMessage || 'Action Plus Membership Discount Applied'}
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-blinkit-green">{applied.youSavedLabel}</p>
                <button
                  type="button"
                  onClick={removeDiscount}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <>
          <p className="text-xs text-gray-500">
            {config.membershipDiscountPercent > 0
              ? `${config.membershipDiscountPercent}% off for active Action Plus members`
              : 'Check if your mobile has an active Action Plus membership'}
          </p>
          {sessionMobile ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || applied?.type === 'COUPON'}
              onClick={() => checkMembership(sessionMobile, { replaceCoupon: false })}
            >
              {busy ? 'Checking…' : 'Check Membership'}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                value={guestMobile}
                onChange={(e) => setGuestMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Mobile number"
                className="h-10"
                inputMode="numeric"
                disabled={busy || applied?.type === 'COUPON'}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={busy || applied?.type === 'COUPON'}
                onClick={() => checkMembership(guestMobile)}
                className="shrink-0"
              >
                Check
              </Button>
            </div>
          )}
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      {info && !error && <p className="text-xs font-medium text-blinkit-green">{info}</p>}
      {applied?.type === 'MEMBERSHIP' && config.couponsEnabled && (
        <p className="text-[11px] text-gray-400">Remove membership discount to apply a coupon.</p>
      )}
      {applied?.type === 'COUPON' && config.membershipEnabled && (
        <p className="text-[11px] text-gray-400">Remove coupon to apply membership discount.</p>
      )}
      {applied && (
        <p className="text-xs font-semibold text-blinkit-green">
          Discount: −{formatCurrency(applied.discountAmount)}
        </p>
      )}
    </div>
  );
}
