'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStaffPortalStore } from '@/store/staffPortalStore';

export default function AccountMobileModal() {
  const { showAccountModal, closeAccountModal, setStaffEligible, clearStaffEligible } = useStaffPortalStore();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [staffDetected, setStaffDetected] = useState(false);

  if (!showAccountModal) return null;

  async function handleContinue() {
    setError('');
    setInfo('');
    setStaffDetected(false);
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
      if (data.isStaff) {
        setStaffEligible(mobile.replace(/\D/g, '').slice(-10));
        setStaffDetected(true);
        setInfo('Staff account detected. "Login as Admin" is now enabled.');
        closeAccountModal();
      } else {
        clearStaffEligible();
        setInfo('No staff account found for this number. Continue as customer.');
      }
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
          {!error && info && (
            <p className={`text-xs ${staffDetected ? 'text-green-600' : 'text-gray-600'}`}>{info}</p>
          )}
          <Button className="w-full" onClick={handleContinue} disabled={loading || mobile.length < 10}>
            {loading ? 'Checking...' : 'Continue'}
          </Button>
          {!staffDetected && info && (
            <Button variant="outline" className="w-full" onClick={closeAccountModal}>
              Continue as Customer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
