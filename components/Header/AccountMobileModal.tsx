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
import { setSessionVerifiedMobile } from '@/utils/whatsappVerificationSession';
import LoginBrandSeal from '@/components/Header/LoginBrandSeal';
import { useConfigStore } from '@/store/configStore';
import { LOGIN_VERIFICATION_POLL_INTERVAL_MS } from '@/constants/whatsappVerification';

interface PendingVerification {
  id: string;
  verificationCode: string;
  mobile: string;
}

type Phase = 'enter' | 'password' | 'waiting' | 'create-password' | 'verified';

export default function AccountMobileModal() {
  const router = useRouter();
  const { showAccountModal, closeAccountModal, setStaffEligible, setCustomerMobile, clearStaffEligible, openAdminLoginModal } =
    useStaffPortalStore();
  const fetchConfig = useConfigStore((s) => s.fetchConfig);
  const showLoginLogo = useConfigStore((s) => s.homepageConfig.showLoginLogo !== false);
  const loginLogoUrl = useConfigStore(
    (s) => s.homepageConfig.loginLogoUrl || '/branding/gobaskit-seal.png',
  );
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

  useEffect(() => {
    if (showAccountModal) void fetchConfig();
  }, [showAccountModal, fetchConfig]);

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
    const e164 = toE164('91', normalized);
    if (e164) setSessionVerifiedMobile(e164);
    if (staffNameRef.current) {
      setStaffEligible(normalized, staffNameRef.current);
    } else {
      setCustomerMobile(normalized);
    }
    // Warm profile, orders, notices, wishlist in one pass for faster account/checkout.
    void import('@/utils/warmCustomerSession').then(({ warmCustomerSession }) => {
      void warmCustomerSession({ force: true });
    });
    // Drop any cart lines that went OOS while the customer was logging in.
    void import('@/utils/refreshCartStock').then(({ refreshCartStockFromServer }) => {
      void refreshCartStockFromServer();
    });
    resetState();
    closeAccountModal();
    router.refresh();
  }

  // Poll for admin / webhook WhatsApp approval → then prompt to create / reset password.
  useEffect(() => {
    if (phase !== 'waiting' || !verification || !mobileE164) return;

    let active = true;
    let inFlight = false;

    const poll = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const params = new URLSearchParams({
          mobile: mobileE164,
          verificationId: verification.id,
        });
        const res = await fetch(`/api/customer/verification/status?${params.toString()}`);
        if (!res.ok || !active) return;
        const data = await res.json();
        const approved =
          data.verified === true || data.verification?.status === 'VERIFIED';
        if (approved) {
          setSessionVerifiedMobile(mobileE164);
          setPhase('create-password');
          setError('');
        }
      } catch {
        /* keep polling */
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, LOGIN_VERIFICATION_POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    const onFocus = () => {
      void poll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
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
      setVerification(data.verification);
      setWhatsappUrl(data.whatsappUrl ?? null);
      setPhase('waiting');
      if (data.whatsappUrl && data.verification?.id) {
        // Open WhatsApp immediately; track "opened" in the background.
        openWhatsAppUrl(data.whatsappUrl);
        void fetch('/api/customer/verification/opened', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: mobileE164, verificationId: data.verification.id }),
        }).catch(() => {});
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
      if (!mobileE164) {
        setError('Enter a valid 10-digit mobile number');
        return;
      }

      // Run staff + auth status checks in parallel to cut login wait.
      const [checkRes, statusRes] = await Promise.all([
        fetch('/api/staff/check-mobile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile }),
        }),
        fetch(`/api/customer/auth/status?mobile=${encodeURIComponent(mobileE164)}`),
      ]);

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
        setStaffEligible(normalized, checkData.staffName);

        // Already signed in as admin → grant customer session for dual-role shopping.
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

        // Staff number but not admin-signed-in yet → admin password, NOT customer WhatsApp.
        setMobile('');
        setPassword('');
        setError('');
        setPhase('enter');
        setVerification(null);
        setWhatsappUrl(null);
        closeAccountModal();
        openAdminLoginModal();
        return;
      }

      staffNameRef.current = '';
      clearStaffEligible();

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="bg-white rounded-3xl w-full max-w-[22rem] px-6 pt-6 pb-7 shadow-2xl relative max-h-[90vh] overflow-y-auto border border-gray-100">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-700 z-10 rounded-full p-1.5 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {phase !== 'verified' && showLoginLogo && loginLogoUrl ? (
          <LoginBrandSeal logoUrl={loginLogoUrl} />
        ) : null}

        {phase === 'verified' ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
            <p className="font-semibold text-green-700">Signed in successfully</p>
          </div>
        ) : phase === 'create-password' ? (
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Create your password</h2>
            <p className="text-sm text-gray-500 mt-1.5 mb-5 leading-relaxed">
              WhatsApp verified. Set a password to sign in next time on any device.
            </p>
            <div className="space-y-3 text-left">
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
              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
              <Button
                className="w-full h-11 rounded-xl font-semibold"
                onClick={handleCreatePassword}
                disabled={loading || password.length < 6}
              >
                {loading ? 'Saving…' : 'Save & Sign In'}
              </Button>
            </div>
          </div>
        ) : phase === 'waiting' && verification ? (
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Verify your WhatsApp</h2>
            <p className="text-sm text-gray-500 mt-1.5 mb-5 leading-relaxed">
              Send this code on WhatsApp. Once confirmed, you&apos;ll set your account password.
            </p>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-1 mb-4 border border-gray-100">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Verification Code</p>
              <p className="text-2xl font-bold tracking-widest text-gray-900">{verification.verificationCode}</p>
              <p className="text-sm text-gray-600">{formatE164Display(verification.mobile)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
              <p className="text-sm font-medium text-amber-900">Waiting for confirmation…</p>
            </div>
            <div className="space-y-2">
              {whatsappUrl && (
                <Button
                  type="button"
                  className="w-full h-11 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white gap-2 font-semibold"
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
          </div>
        ) : phase === 'password' ? (
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1.5 mb-5">
              +91 {mobile}
              <button
                type="button"
                className="ml-2 text-blinkit-green text-xs font-semibold"
                onClick={() => {
                  setPhase('enter');
                  setPassword('');
                  setError('');
                }}
              >
                Change
              </button>
            </p>
            <div className="space-y-3 text-left">
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
                  <p className="text-amber-600 text-xs mt-1 text-center">
                    {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining
                  </p>
                )}
              </div>
              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
              <Button
                className="w-full h-11 rounded-xl font-semibold"
                onClick={handlePasswordLogin}
                disabled={loading || password.length < 6}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-blinkit-green font-semibold py-1"
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
          </div>
        ) : (
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">My Account</h2>
            <p className="text-sm text-gray-500 mt-1.5 mb-5 leading-relaxed">
              Enter your mobile number to continue
            </p>
            <div className="space-y-3 text-left">
              <div>
                <Label className="text-center block w-full mb-2 text-sm font-medium text-gray-700">
                  Mobile Number
                </Label>
                <label className="flex items-center w-full h-12 rounded-2xl border border-gray-200 bg-white px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-within:border-blinkit-green/50 focus-within:ring-2 focus-within:ring-blinkit-green/15 transition-shadow">
                  <span className="text-[15px] font-semibold text-gray-900 tabular-nums select-none">
                    +91
                  </span>
                  <span className="mx-3 h-5 w-px bg-gray-200 shrink-0" aria-hidden />
                  <input
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(-10))}
                    placeholder="Enter mobile number"
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="tel-national"
                    className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] text-gray-900 placeholder:text-gray-400 tracking-wide"
                    onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                    aria-label="Mobile number"
                  />
                </label>
              </div>
              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
              <Button
                className="w-full h-11 rounded-xl font-semibold text-base"
                onClick={handleContinue}
                disabled={loading || mobile.length < 10}
              >
                {loading ? 'Checking…' : 'Continue'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
