'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStaffPortalStore } from '@/store/staffPortalStore';
import { toE164 } from '@/utils/phone';

export default function StaffAdminLoginModal() {
  const router = useRouter();
  const { showAdminLoginModal, closeAdminLoginModal, checkedMobile } = useStaffPortalStore();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!showAdminLoginModal) return null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: checkedMobile, password, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      // Dual role: admin session also opens a customer session on their number.
      const mobileE164 = toE164('91', checkedMobile);
      if (mobileE164) {
        await fetch('/api/customer/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: mobileE164 }),
        }).catch(() => null);
      }
      closeAdminLoginModal();
      router.push('/admin/dashboard');
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
          onClick={closeAdminLoginModal}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold mb-1">Admin Login</h2>
        <p className="text-sm text-gray-500 mb-4">Use your staff password (not your customer account password).</p>
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <Label>Mobile Number</Label>
            <Input value={checkedMobile} readOnly className="mt-1 bg-gray-50" />
          </div>
          <div>
            <Label>Password</Label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 my-auto text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="accent-blinkit-green"
            />
            Remember me
          </label>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </div>
    </div>
  );
}
