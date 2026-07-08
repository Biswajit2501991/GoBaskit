'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStaffPortalStore } from '@/store/staffPortalStore';
import { clearCheckoutProfileLocal, loadCheckoutProfileLocal } from '@/utils/customerProfile';
import { normalizeMobile } from '@/utils/mobile';

export default function AccountMobileModal() {
  const router = useRouter();
  const { showAccountModal, closeAccountModal, setStaffEligible, setCustomerMobile, clearStaffEligible } =
    useStaffPortalStore();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  if (!showAccountModal) return null;

  async function handleContinue() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/staff/check-mobile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      const normalized = normalizeMobile(mobile);
      // Switching to a different number must not carry over the previous
      // person's cached checkout details (name/address/mobile) — otherwise the
      // new number inherits the old identity and can skip WhatsApp verification.
      const prevProfile = loadCheckoutProfileLocal();
      if (prevProfile && normalizeMobile(prevProfile.mobile) !== normalized) {
        clearCheckoutProfileLocal();
      }

      if (data.isStaff) {
        setStaffEligible(normalized, data.staffName);
        closeAccountModal();
      } else {
        clearStaffEligible();
        // For normal customers, automatically continue with this number.
        setCustomerMobile(normalized);
        await fetch('/api/customer/account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: normalized }),
        }).catch(() => null);
        closeAccountModal();
      }
      setMobile('');
      // Reflect the new session cookie in any server-rendered UI (e.g. account).
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl relative">
        <button
          type="button"
          onClick={closeAccountModal}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold mb-1">My Account</h2>
        <p className="text-sm text-gray-500 mb-4">Enter your mobile number to continue</p>
        <div className="space-y-3">
          <div>
            <Label>Mobile Number</Label>
            <div className="flex gap-2 mt-1">
              <span className="inline-flex items-center px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600">
                +91
              </span>
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(-10))}
                placeholder="10-digit number"
                inputMode="numeric"
                maxLength={10}
                className="flex-1"
              />
            </div>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <Button className="w-full" onClick={handleContinue} disabled={loading || mobile.length < 10}>
            {loading ? 'Checking...' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
