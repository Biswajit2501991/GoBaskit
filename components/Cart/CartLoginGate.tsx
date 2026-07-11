'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStaffPortalStore } from '@/store/staffPortalStore';

type CartLoginGateProps = {
  children: ReactNode;
  /** Shown under the login CTA (e.g. item count hint). */
  subtitle?: string;
  /** Optional secondary action (e.g. close drawer / continue shopping). */
  secondaryAction?: ReactNode;
};

/**
 * Guests may add/change quantities from product UI only.
 * Opening cart (drawer or page) requires login before the full cart flow.
 */
export default function CartLoginGate({
  children,
  subtitle = 'Log in to view your cart, apply offers, and checkout.',
  secondaryAction,
}: CartLoginGateProps) {
  const customerMobile = useStaffPortalStore((s) => s.customerMobile);
  const setCustomerMobile = useStaffPortalStore((s) => s.setCustomerMobile);
  const openAccountModal = useStaffPortalStore((s) => s.openAccountModal);
  const [checking, setChecking] = useState(!customerMobile);

  useEffect(() => {
    if (customerMobile) {
      setChecking(false);
      return;
    }

    let alive = true;
    setChecking(true);
    fetch('/api/customer/account')
      .then((res) => res.json())
      .then((data: { mobile?: string | null }) => {
        if (!alive) return;
        if (data.mobile) {
          setCustomerMobile(data.mobile);
        }
        setChecking(false);
      })
      .catch(() => {
        if (!alive) return;
        setChecking(false);
      });

    return () => {
      alive = false;
    };
  }, [customerMobile, setCustomerMobile]);

  if (customerMobile) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="flex-1 min-h-0 p-4 space-y-3 overflow-y-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-16 h-16 rounded-full bg-blinkit-green-light flex items-center justify-center mb-4">
        <User className="w-8 h-8 text-blinkit-green" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Login to Proceed</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-xs">{subtitle}</p>
      <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs justify-center">
        <Button type="button" onClick={openAccountModal} className="w-full sm:w-auto">
          Login to Proceed
        </Button>
        {secondaryAction}
      </div>
      <p className="text-[11px] text-gray-400 mt-4 max-w-xs">
        You can still add and change items from the store without logging in.
      </p>
    </div>
  );
}
