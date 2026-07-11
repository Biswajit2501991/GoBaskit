'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDiscountStore, type AppliedDiscount } from '@/store/discountStore';
import { useStaffPortalStore } from '@/store/staffPortalStore';
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
  const openAccountModal = useStaffPortalStore((s) => s.openAccountModal);

  const [config, setConfig] = useState<PublicDiscountConfig | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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

  // Drop stale quotes when cart subtotal changes
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
      setError('');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [subtotal, applied, clearDiscount]);

  const applyQuote = useCallback(
    (quote: AppliedDiscount) => {
      setApplied(quote);
      setError('');
      setCode('');
    },
    [setApplied],
  );

  const sessionMobile = customerMobile ? normalizeMobile(customerMobile) : '';
  const loggedIn = sessionMobile.length === 10;

  const verifyMembership = useCallback(async () => {
    if (!config?.membershipEnabled || subtotal <= 0) return;
    if (applied?.type === 'COUPON') {
      setError('Remove coupon first to verify membership discount');
      return;
    }
    if (sessionMobile.length !== 10) {
      setError('Please log in to verify membership');
      openAccountModal();
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/discount/membership/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtotal }),
      });
      const data = await res.json();
      if (res.status === 401 || data.code === 'LOGIN_REQUIRED') {
        setError('Please log in to verify membership');
        openAccountModal();
        return;
      }
      if (!data.ok) {
        setError(data.error || 'No Active Membership Found');
        return;
      }
      applyQuote({
        type: 'MEMBERSHIP',
        discountAmount: data.discountAmount,
        memberId: data.memberId ?? null,
        message: data.message || 'Action Plus Membership Discount Applied',
        youSavedLabel: data.youSavedLabel,
        quotedSubtotal: subtotal,
      });
    } catch {
      setError('Membership verification failed. Try again.');
    } finally {
      setBusy(false);
    }
  }, [
    config?.membershipEnabled,
    subtotal,
    applied,
    sessionMobile,
    applyQuote,
    openAccountModal,
  ]);

  async function applyCoupon() {
    if (!config?.couponsEnabled) return;
    if (sessionMobile.length !== 10) {
      setError('Please log in to apply offers');
      openAccountModal();
      return;
    }
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
    try {
      const res = await fetch('/api/discount/coupon/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: trimmed,
          subtotal,
        }),
      });
      const data = await res.json();
      if (res.status === 401 || data.code === 'LOGIN_REQUIRED') {
        setError('Please log in to apply a coupon');
        openAccountModal();
        return;
      }
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
    setCode('');
  }

  if (!config) return null;
  if (!config.couponsEnabled && !config.membershipEnabled) return null;

  const membershipApplied = applied?.type === 'MEMBERSHIP';
  const couponApplied = applied?.type === 'COUPON';
  const showChoiceScreen = !applied;

  return (
    <div className="space-y-3">
      {/* Choice screen / coupon path — matches cart design when nothing applied */}
      {config.couponsEnabled && (showChoiceScreen || couponApplied) && (
        <div className="rounded-xl border border-dashed border-blinkit-green/50 bg-[#E8F8EE] p-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-blinkit-green flex items-center justify-center shrink-0 text-white font-bold text-sm">
              %
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-gray-900">Apply Coupon Code</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {loggedIn ? 'Enter code to get discount' : 'Log in to apply a coupon'}
              </p>
              {couponApplied ? (
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
              ) : loggedIn ? (
                <div className="mt-2.5 flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="bg-white h-10"
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void applyCoupon();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => void applyCoupon()}
                    disabled={busy}
                    className="shrink-0 px-5"
                  >
                    Apply
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    setError('');
                    openAccountModal();
                  }}
                  className="mt-2.5 w-full sm:w-auto"
                >
                  Login to apply
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Membership: Verify on choice screen; applied state with Remove */}
      {config.membershipEnabled && (showChoiceScreen || membershipApplied) && (
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 space-y-2">
          <p className="font-bold text-sm text-gray-900">Action Plus Membership</p>
          {membershipApplied ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-blinkit-green">
                  {applied.message || 'Action Plus Membership Discount Applied'}
                </p>
                <p className="text-xs text-blinkit-green">{applied.youSavedLabel}</p>
              </div>
              <button
                type="button"
                onClick={removeDiscount}
                className="text-xs font-medium text-red-500 hover:text-red-600 shrink-0"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                {loggedIn
                  ? config.membershipDiscountPercent > 0
                    ? `${config.membershipDiscountPercent}% off for active Action Plus members`
                    : 'Verify your Action Plus membership to get a discount'
                  : 'Log in to verify your Action Plus membership and get the offer'}
              </p>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!loggedIn) {
                    setError('');
                    openAccountModal();
                    return;
                  }
                  void verifyMembership();
                }}
                className="w-full sm:w-auto"
              >
                {busy ? 'Verifying…' : loggedIn ? 'Verify' : 'Login to verify'}
              </Button>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
