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

async function readServerSessionMobile(): Promise<string | null> {
  try {
    const res = await fetch('/api/customer/account', {
      credentials: 'include',
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as { mobile?: string | null };
    if (typeof data.mobile === 'string' && data.mobile) {
      return normalizeMobile(data.mobile);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function CouponSection({ subtotal }: CouponSectionProps) {
  const applied = useDiscountStore((s) => s.applied);
  const setApplied = useDiscountStore((s) => s.setApplied);
  const clearDiscount = useDiscountStore((s) => s.clear);
  const customerMobile = useStaffPortalStore((s) => s.customerMobile);
  const setCustomerMobile = useStaffPortalStore((s) => s.setCustomerMobile);
  const clearAccount = useStaffPortalStore((s) => s.clearAccount);
  const openAccountModal = useStaffPortalStore((s) => s.openAccountModal);

  const [config, setConfig] = useState<PublicDiscountConfig | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [serverSessionOk, setServerSessionOk] = useState(false);
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

  // Keep UI login state aligned with the httpOnly session cookie.
  useEffect(() => {
    let alive = true;
    if (!customerMobile) {
      setServerSessionOk(false);
      return;
    }
    void readServerSessionMobile().then((mobile) => {
      if (!alive) return;
      if (mobile) {
        setServerSessionOk(true);
        if (mobile !== normalizeMobile(customerMobile)) {
          setCustomerMobile(mobile);
        }
      } else {
        setServerSessionOk(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [customerMobile, setCustomerMobile]);

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

  // Guests cannot keep an applied offer — clear if session ends.
  useEffect(() => {
    if (!customerMobile && applied) {
      clearDiscount();
      setError('');
      setCode('');
    }
  }, [customerMobile, applied, clearDiscount]);

  const applyQuote = useCallback(
    (quote: AppliedDiscount) => {
      setApplied(quote);
      setError('');
      setCode('');
    },
    [setApplied],
  );

  const sessionMobile = customerMobile ? normalizeMobile(customerMobile) : '';
  const loggedIn = sessionMobile.length === 10 && serverSessionOk;

  const handleSessionLost = useCallback(() => {
    clearDiscount();
    clearAccount();
    setServerSessionOk(false);
    setError('Please log in again to verify membership');
    openAccountModal();
  }, [clearDiscount, clearAccount, openAccountModal]);

  const verifyMembership = useCallback(async () => {
    if (!config?.membershipEnabled || subtotal <= 0) return;
    if (applied?.type === 'COUPON') {
      setError('Remove coupon first to verify membership discount');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const serverMobile = await readServerSessionMobile();
      if (!serverMobile) {
        handleSessionLost();
        return;
      }
      setServerSessionOk(true);
      if (serverMobile !== sessionMobile) {
        setCustomerMobile(serverMobile);
      }

      const res = await fetch('/api/discount/membership/check', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtotal }),
      });
      const data = await res.json();
      if (res.status === 401 || data.code === 'LOGIN_REQUIRED') {
        handleSessionLost();
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
    applyQuote,
    sessionMobile,
    setCustomerMobile,
    handleSessionLost,
  ]);

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
    try {
      const serverMobile = await readServerSessionMobile();
      if (!serverMobile) {
        handleSessionLost();
        return;
      }
      setServerSessionOk(true);

      const res = await fetch('/api/discount/coupon/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: trimmed,
          subtotal,
        }),
      });
      const data = await res.json();
      if (res.status === 401 || data.code === 'LOGIN_REQUIRED') {
        handleSessionLost();
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
      setError('Coupon validation failed. Try again.');
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

  const couponApplied = applied?.type === 'COUPON';
  const membershipApplied = applied?.type === 'MEMBERSHIP';
  const showChoiceScreen = !applied;

  return (
    <div className="space-y-3">
      {/* Coupons */}
      {config.couponsEnabled && (showChoiceScreen || couponApplied) && (
        <div
          className={`rounded-xl border border-gray-100 bg-white p-3.5 space-y-2 ${
            !loggedIn ? 'opacity-80' : ''
          }`}
        >
          <p className="font-bold text-sm text-gray-900">Coupon</p>
          <div>
            {couponApplied && loggedIn ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-blinkit-green">
                    {applied.couponCode} applied
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
                    ? 'Enter a coupon code to apply a discount'
                    : 'Log in to apply a coupon'}
                </p>
                <div
                  className={`mt-2.5 flex gap-2 ${!loggedIn ? 'pointer-events-none' : ''}`}
                  aria-disabled={!loggedIn}
                >
                  <Input
                    value={loggedIn ? code : ''}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    className="uppercase"
                    disabled={!loggedIn || busy}
                    readOnly={!loggedIn}
                    onKeyDown={(e) => {
                      if (!loggedIn) return;
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void applyCoupon();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    disabled={!loggedIn || busy}
                    onClick={() => void applyCoupon()}
                    tabIndex={loggedIn ? undefined : -1}
                  >
                    Apply
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Membership */}
      {config.membershipEnabled && (showChoiceScreen || membershipApplied) && (
        <div
          className={`rounded-xl border border-gray-100 bg-white p-3.5 space-y-2 ${
            !loggedIn ? 'opacity-80' : ''
          }`}
        >
          <p className="font-bold text-sm text-gray-900">Action Plus Membership</p>
          {membershipApplied && loggedIn ? (
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
                  : customerMobile
                    ? 'Confirming your login session…'
                    : 'Log in to verify your Action Plus membership and get the offer'}
              </p>
              <Button
                type="button"
                disabled={(!loggedIn && !customerMobile) || busy}
                onClick={() => {
                  if (!loggedIn) {
                    if (customerMobile) {
                      void verifyMembership();
                      return;
                    }
                    openAccountModal();
                    return;
                  }
                  void verifyMembership();
                }}
                className="w-full sm:w-auto"
              >
                {busy ? 'Verifying…' : loggedIn || customerMobile ? 'Verify' : 'Log in to Verify'}
              </Button>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
