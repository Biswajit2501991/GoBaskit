'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, MessageCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStaffPortalStore } from '@/store/staffPortalStore';
import { clearCheckoutProfileLocal, loadCheckoutProfileLocal } from '@/utils/customerProfile';
import { normalizeMobile } from '@/utils/mobile';
import { toE164, formatE164Display } from '@/utils/phone';
import { openWhatsAppUrl } from '@/utils/whatsapp';

const LOGIN_POLL_INTERVAL_MS = 4000;

interface PendingVerification {
  id: string;
  verificationCode: string;
  mobile: string;
}

type Phase = 'enter' | 'password' | 'waiting' | 'create-password' | 'verified';

export default function AccountMobileModal() {
  const router = useRouter();
  const { showAccountModal, closeAccountModal, setStaffEligible, setCustomerMobile, clearStaffEligible } =
    useStaffPortalStore();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('enter');
  const [verification, setVerification] = useState<PendingVerification | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const staffNameRef = useRef<string>('');

  const mobileE164 = toE164('91', mobile);

  function resetState() {
    setMobile('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setError('');
    setLoading(false);
    setPhase('enter');
    setVerification(null);
    setWhatsappUrl(null);
    setAttemptsRemaining(null);
    staffNameRef.current = '';
  }

  function handleClose() {
    resetState();
    closeAccountModal();
  }

  function finishLogin(normalized: string) {
    if (staffNameRef.current) {
      setStaffEligible(normalized, staffNameRef.current);
    } else {
      setCustomerMobile(normalized);
    }
    resetState();
    closeAccountModal();
    router.refresh();
  }

  // Poll for admin WhatsApp approval → then prompt to create / reset password.
  useEffect(() => {
    if (phase !== 'waiting' || !verification || !mobileE164) return;

    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/customer/verification/status?mobile=${encodeURIComponent(mobileE164)}`,
        );
        if (!res.ok || !active) return;
        const data = await res.json();
        if (data.verified) {
          setPhase('create-password');
          setError('');
        }
      } catch {
        /* keep polling */
      }
    };

    poll();
    const timer = setInterval(poll, LOGIN_POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [phase, verification, mobileE164]);

  if (!showAccountModal) return null;

  async function startVerification(forceNew: boolean) {
    if (!mobileE164) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/customer/verification/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: mobileE164,
          purpose: 'login',
          forceNew,
          customerName: staffNameRef.current || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not start verification');
        return;
      }
      if (data.verified && data.verification) {
        // Already has pending verification reused
      }
      setVerification(data.verification);
      setWhatsappUrl(data.whatsappUrl ?? null);
      setPhase('waiting');
      if (data.whatsappUrl && data.verification?.id) {
        await fetch('/api/customer/verification/opened', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: mobileE164, verificationId: data.verification.id }),
        }).catch(() => {});
        openWhatsAppUrl(data.whatsappUrl);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    setError('');
    setLoading(true);
    try {
      const normalized = normalizeMobile(mobile);
      const checkRes = await fetch('/api/staff/check-mobile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const checkData = await checkRes.json().catch(() => ({}));
      if (!checkRes.ok) {
        setError(checkData.error || 'Something went wrong');
        return;
      }

      const prevProfile = loadCheckoutProfileLocal();
      if (prevProfile && normalizeMobile(prevProfile.mobile) !== normalized) {
        clearCheckoutProfileLocal();
      }

      if (checkData.isStaff) {
        staffNameRef.current = checkData.staffName || '';
      } else {
        staffNameRef.current = '';
        clearStaffEligible();
      }

      // Authenticated staff on their own number can skip customer password.
      const sessionRes = await fetch('/api/customer/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobileE164 }),
      });
      const sessionData = await sessionRes.json().catch(() => ({}));
      if (sessionRes.ok && sessionData.verified) {
        finishLogin(normalized);
        return;
      }

      const statusRes = await fetch(
        `/api/customer/auth/status?mobile=${encodeURIComponent(mobileE164!)}`,
      );
      const status = statusRes.ok ? await statusRes.json() : { requiresWhatsApp: true };

      if (status.hasPassword && !status.isLocked) {
        setPhase('password');
        setAttemptsRemaining(status.attemptsRemaining ?? null);
        return;
      }

      await startVerification(false);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin() {
    if (!mobileE164 || password.length < 6) {
      setError('Enter your password (min 6 characters)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: mobileE164, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.locked || data.code === 'LOCKED') {
          setError(data.error || 'Account locked. Verify via WhatsApp to reset.');
          setAttemptsRemaining(0);
          return;
        }
        if (data.code === 'NO_PASSWORD') {
          setError(data.error);
          return;
        }
        setAttemptsRemaining(
          typeof data.attemptsRemaining === 'number' ? data.attemptsRemaining : null,
        );
        setError(data.error || 'Incorrect password');
        return;
      }
      setPhase('verified');
      setTimeout(() => finishLogin(normalizeMobile(mobile)), 800);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePassword() {
    if (!mobileE164 || !verification?.id) {
      setError('Verification expired. Please try again.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/customer/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: mobileE164,
          password,
          confirmPassword,
          verificationId: verification.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save password');
        return;
      }
      setPhase('verified');
      setTimeout(() => finishLogin(normalizeMobile(mobile)), 800);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {phase === 'verified' ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
            <p className="font-semibold text-green-700">Signed in successfully</p>
          </div>
        ) : phase === 'create-password' ? (
          <>
            <h2 className="text-lg font-bold mb-1">Create your password</h2>
            <p className="text-sm text-gray-500 mb-4">
              WhatsApp verified! Set a password to sign in next time on any device.
            </p>
            <div className="space-y-3">
              <div>
                <Label>Password</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>Confirm Password</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="mt-1"
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <Button
                className="w-full"
                onClick={handleCreatePassword}
                disabled={loading || password.length < 6}
              >
                {loading ? 'Saving…' : 'Save & Sign In'}
              </Button>
            </div>
          </>
        ) : phase === 'waiting' && verification ? (
          <>
            <h2 className="text-lg font-bold mb-1">Verify your WhatsApp</h2>
            <p className="text-sm text-gray-500 mb-4">
              Send this code on WhatsApp. Once confirmed, you&apos;ll set your account password.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-center space-y-1 mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Verification Code</p>
              <p className="text-2xl font-bold tracking-widest">{verification.verificationCode}</p>
              <p className="text-sm text-gray-600">{formatE164Display(verification.mobile)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center mb-4">
              <p className="text-sm font-medium text-amber-900">Waiting for confirmation…</p>
            </div>
            <div className="space-y-2">
              {whatsappUrl && (
                <Button
                  type="button"
                  className="w-full bg-[#25D366] hover:bg-[#1ebe57] text-white gap-2"
                  onClick={() => openWhatsAppUrl(whatsappUrl)}
                >
                  <MessageCircle className="w-5 h-5" />
                  Open WhatsApp Again
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                className="w-full text-gray-500"
                disabled={loading}
                onClick={() => startVerification(true)}
              >
                Generate New Code
              </Button>
            </div>
          </>
        ) : phase === 'password' ? (
          <>
            <h2 className="text-lg font-bold mb-1">Welcome back</h2>
            <p className="text-sm text-gray-500 mb-4">
              +91 {mobile}
              <button
                type="button"
                className="ml-2 text-blinkit-green text-xs font-medium"
                onClick={() => {
                  setPhase('enter');
                  setPassword('');
                  setError('');
                }}
              >
                Change
              </button>
            </p>
            <div className="space-y-3">
              <div>
                <Label>Password</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your account password"
                    className="pr-10"
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordLogin()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {attemptsRemaining !== null && attemptsRemaining < 3 && attemptsRemaining > 0 && (
                  <p className="text-amber-600 text-xs mt-1">
                    {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining
                  </p>
                )}
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <Button
                className="w-full"
                onClick={handlePasswordLogin}
                disabled={loading || password.length < 6}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-blinkit-green font-medium py-1"
                disabled={loading}
                onClick={() => {
                  setPassword('');
                  setError('');
                  startVerification(true);
                }}
              >
                Forgot password? Verify via WhatsApp
              </button>
            </div>
          </>
        ) : (
          <>
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
                    onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <Button className="w-full" onClick={handleContinue} disabled={loading || mobile.length < 10}>
                {loading ? 'Checking…' : 'Continue'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
