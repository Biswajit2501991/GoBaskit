'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Copy, Check, CreditCard, Shield } from 'lucide-react';
import { useConfigStore } from '@/store/configStore';

type Props = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  accountLabel: string;
  staffEligible: boolean;
  customerMobile: string;
  showAdminEntry: boolean;
  adminSessionActive: boolean;
  wishlistCount: number;
  onClose: () => void;
  onOpenAdmin: () => void;
  onUseAnotherNumber: () => void;
  onLogout: () => void;
};

export default function AccountMenu({
  open,
  anchorRef,
  accountLabel,
  staffEligible,
  customerMobile,
  showAdminEntry,
  adminSessionActive,
  wishlistCount,
  onClose,
  onOpenAdmin,
  onUseAnotherNumber,
  onLogout,
}: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 12 });
  const [showPayment, setShowPayment] = useState(false);
  const [copied, setCopied] = useState(false);
  const upiId = useConfigStore((s) => s.upiId.trim());
  const upiQrImageUrl = useConfigStore((s) => s.upiQrImageUrl.trim());
  const hasPaymentDetails = Boolean(upiId || upiQrImageUrl);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setShowPayment(false);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: Math.round(rect.bottom + 8),
        right: Math.max(8, Math.round(window.innerWidth - rect.right)),
      });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, anchorRef, onClose]);

  async function copyUpiId() {
    if (!upiId) return;
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked */
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[200] w-[min(18rem,calc(100vw-1rem))] max-h-[min(70vh,28rem)] overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-xl p-2"
      style={{ top: pos.top, right: pos.right }}
    >
      <p className="px-2 py-1 text-[11px] text-gray-500 truncate">{accountLabel}</p>
      {staffEligible && (
        <p className="px-2 pb-1 text-[10px] text-gray-400">You&apos;re shopping as a customer</p>
      )}
      {customerMobile && (
        <>
          <Link
            href="/account"
            role="menuitem"
            onClick={onClose}
            className="block w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50 font-medium text-blinkit-green"
          >
            My Account
          </Link>
          <Link
            href="/account#wishlist"
            role="menuitem"
            onClick={onClose}
            className="block w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50 font-medium text-gray-900"
          >
            My Wishlist{wishlistCount > 0 ? ` (${wishlistCount})` : ''}
          </Link>
          <Link
            href="/account/track"
            role="menuitem"
            onClick={onClose}
            className="block w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50 font-medium text-gray-900"
          >
            Track My Orders
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => setShowPayment((v) => !v)}
            className="w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50 font-medium text-gray-900 flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Payment Options
          </button>
          {showPayment && (
            <div className="mx-1 mb-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5 space-y-2">
              {hasPaymentDetails ? (
                <>
                  {upiQrImageUrl ? (
                    <div className="mx-auto w-36 h-36 rounded-lg overflow-hidden bg-white border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={upiQrImageUrl}
                        alt="UPI QR code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : null}
                  {upiId ? (
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 flex-1 text-xs font-semibold text-gray-900 break-all">
                        {upiId}
                      </p>
                      <button
                        type="button"
                        onClick={copyUpiId}
                        className="shrink-0 inline-flex items-center gap-1 rounded-md bg-white border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  UPI details will appear here once they are added in Admin → Settings → Payments.
                </p>
              )}
            </div>
          )}
        </>
      )}
      {showAdminEntry && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onOpenAdmin();
          }}
          className="w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50 font-medium text-gray-900 flex items-center gap-1.5"
        >
          <Shield className="w-3.5 h-3.5" />
          {adminSessionActive ? 'Open Admin' : 'Login as Admin'}
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onUseAnotherNumber();
        }}
        className="w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-gray-50"
      >
        Use another number
      </button>
      {customerMobile && (
        <button
          type="button"
          role="menuitem"
          onClick={onLogout}
          className="w-full text-left px-2 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50"
        >
          Logout
        </button>
      )}
    </div>,
    document.body,
  );
}
