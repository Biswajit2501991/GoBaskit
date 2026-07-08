'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeMobile } from '@/utils/mobile';
import { toE164 } from '@/utils/phone';

export default function AdminLoginPage() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: normalizeMobile(mobile), password, rememberMe }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      const mobileE164 = toE164('91', normalizeMobile(mobile));
      if (mobileE164) {
        await fetch('/api/customer/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: mobileE164 }),
        }).catch(() => null);
      }
      router.push('/admin/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <div className="text-center mb-8">
          <div className="bg-blinkit-yellow rounded-lg px-3 py-1.5 inline-block mb-4">
            <span className="font-extrabold text-xl">
              Go<span className="text-blinkit-green">Baskit</span>
            </span>
          </div>
          <h1 className="text-xl font-bold">Admin Login</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
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
                autoComplete="username"
                className="flex-1"
              />
            </div>
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
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || mobile.length < 10 || !password}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
