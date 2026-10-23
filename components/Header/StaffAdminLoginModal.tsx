'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, Eye, EyeOff } from 'lucide-react';
import LoginBrandSeal from '@/components/Header/LoginBrandSeal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { markAndroidAlertsPromptAfterLogin } from '@/lib/admin-push-client';
import { staffHomePath } from '@/types/staff';
import type { StaffRole } from '@prisma/client';
import { useStaffPortalStore } from '@/store/staffPortalStore';
import { toE164 } from '@/utils/phone';

export default function StaffAdminLoginModal() {
  const router = useRouter();
  const { showAdminLoginModal, closeAdminLoginModal, checkedMobile, setAdminSessionActive } =
    useStaffPortalStore();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!showAdminLoginModal || !mounted) return null;

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
      setAdminSessionActive(true, {
        mobile: checkedMobile,
      });
      markAndroidAlertsPromptAfterLogin();
      const home =
        typeof data.staff?.homePath === 'string' && data.staff.homePath
          ? data.staff.homePath
          : data.staff?.shopId || data.staff?.role
            ? staffHomePath({
                role: (data.staff.role ?? 'READ_ONLY') as StaffRole,
                shopId: data.staff.shopId ?? null,
              })
            : '/admin/dashboard';
      router.push(home);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-forest/45" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Admin Login"
        className="relative z-10 isolate bg-white text-gray-900 [color-scheme:light] rounded-3xl w-full max-w-sm p-6 shadow-xl border border-paper-deep"
      >
        <button
          type="button"
          onClick={closeAdminLoginModal}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <LoginBrandSeal suffix="Admin" />
        <h2 className="text-lg font-bold mb-1 text-center">Admin Login</h2>
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
              className="accent-forest"
            />
            Remember me
          </label>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
