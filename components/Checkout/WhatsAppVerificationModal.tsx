'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_COUNTRY_OPTIONS, LOGIN_VERIFICATION_POLL_INTERVAL_MS } from '@/constants/whatsappVerification';
import {
  detectCountryFromBrowser,
  formatE164Display,
  stripPhoneInput,
  toE164,
} from '@/utils/phone';
import { isValidIndianMobile, normalizeMobile } from '@/utils/mobile';
import { openWhatsAppUrl } from '@/utils/whatsapp';
import { prepareCheckoutVerification } from '@/utils/prepareCheckoutVerification';

interface VerificationData {
  id: string;
  mobile: string;
  verificationCode: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
}

interface WhatsAppVerificationModalProps {
  open: boolean;
  initialNationalNumber?: string;
  initialCountryDial?: string;
  customerName?: string;
  /** Called as soon as the number is verified so checkout can resume. */
  onVerified: (mobileE164: string) => void;
  onClose: () => void;
}

export default function WhatsAppVerificationModal({
  open,
  initialNationalNumber = '',
  initialCountryDial,
  customerName,
  onVerified,
  onClose,
}: WhatsAppVerificationModalProps) {
  const defaultCountry = useMemo(() => detectCountryFromBrowser(), []);
  const [countryDial, setCountryDial] = useState(initialCountryDial || defaultCountry.dial);
  const [nationalNumber, setNationalNumber] = useState(initialNationalNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState(false);

  const mobileE164 = useMemo(() => toE164(countryDial, nationalNumber), [countryDial, nationalNumber]);
  const nationalValid =
    countryDial === '91'
      ? isValidIndianMobile(normalizeMobile(nationalNumber))
      : Boolean(mobileE164);

  const leftForWhatsAppRef = useRef(false);
  const sentInFlightRef = useRef(false);
  const verifiedRef = useRef(false);
  const hiddenAtRef = useRef(0);
  const verificationRef = useRef(verification);
  const mobileRef = useRef(mobileE164);
  const onVerifiedRef = useRef(onVerified);
  verificationRef.current = verification;
  mobileRef.current = mobileE164;
  onVerifiedRef.current = onVerified;
  verifiedRef.current = verified;

  const verificationIdRef = useRef<string | null>(null);
  const autoStartedRef = useRef(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      autoStartedRef.current = false;
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (justOpened) {
      setError('');
      setVerified(false);
      setPending(false);
      setVerification(null);
      setWhatsappUrl(null);
      leftForWhatsAppRef.current = false;
      sentInFlightRef.current = false;
      verifiedRef.current = false;
      hiddenAtRef.current = 0;
      verificationIdRef.current = null;
    }
    const seed = initialNationalNumber.replace(/\D/g, '').slice(-10);
    setNationalNumber(seed);
    setCountryDial(initialCountryDial || defaultCountry.dial);
  }, [open, initialNationalNumber, initialCountryDial, defaultCountry.dial]);

  const finishVerified = useCallback((mobile: string) => {
    verifiedRef.current = true;
    setVerified(true);
    setPending(false);
    try {
      sessionStorage.setItem('gobaskit_account_verified_toast', '1');
    } catch {
      /* ignore */
    }
    onVerifiedRef.current(mobile);
  }, []);

  const acknowledgeSent = useCallback(async () => {
    const mobile = mobileRef.current;
    const verificationId = verificationIdRef.current ?? verificationRef.current?.id;
    if (!mobile || verifiedRef.current || sentInFlightRef.current) return;
    sentInFlightRef.current = true;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/customer/verification/sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile,
          ...(verificationId ? { verificationId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        sentInFlightRef.current = false;
        setError(typeof data.error === 'string' ? data.error : 'Could not confirm message sent');
        return;
      }
      if (data.verified === true) {
        finishVerified(mobile);
        return;
      }
      sentInFlightRef.current = false;
      setError(
        'Waiting for WhatsApp from this same number. Send the code from the WhatsApp logged in with the number you entered.',
      );
    } finally {
      setLoading(false);
    }
  }, [finishVerified]);

  const markOpenedWhatsApp = useCallback((mobile: string, verification: VerificationData, url: string) => {
    mobileRef.current = mobile;
    verificationRef.current = verification;
    verificationIdRef.current = verification.id;
    leftForWhatsAppRef.current = true;
    hiddenAtRef.current = Date.now();
    setVerification(verification);
    setWhatsappUrl(url);
    setPending(true);
    openWhatsAppUrl(url);
    void fetch('/api/customer/verification/opened', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile,
        verificationId: verification.id,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.verified === true) {
          finishVerified(mobile);
        }
      })
      .catch(() => {});
  }, [finishVerified]);

  useEffect(() => {
    if (!open || verified) return;

    const onHidden = () => {
      leftForWhatsAppRef.current = true;
      if (!hiddenAtRef.current) hiddenAtRef.current = Date.now();
    };
    const onReturn = () => {
      if (!leftForWhatsAppRef.current || verifiedRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (hiddenAtRef.current && Date.now() - hiddenAtRef.current < 700) return;
      void acknowledgeSent();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHidden();
      else onReturn();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onReturn);
    window.addEventListener('pageshow', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('pageshow', onReturn);
    };
  }, [open, verified, acknowledgeSent]);

  useEffect(() => {
    if (!open || verified || !pending) return;
    const mobile = mobileE164;
    const verificationId = verification?.id;
    if (!mobile || !verificationId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const params = new URLSearchParams({ mobile, verificationId });
        const res = await fetch(`/api/customer/verification/status?${params.toString()}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.verified === true || data.verification?.status === 'VERIFIED') {
          finishVerified(mobile);
        }
      } catch {
        /* keep polling */
      }
    };
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, LOGIN_VERIFICATION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [open, verified, pending, mobileE164, verification?.id, finishVerified]);

  const generateCode = useCallback(
    async (forceNew = false) => {
      if (!mobileE164 || !nationalValid) {
        setError(
          countryDial === '91'
            ? 'Enter a valid 10-digit Indian mobile number'
            : 'Enter a valid mobile number with country code',
        );
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await prepareCheckoutVerification(mobileE164, {
          customerName,
          forceNew,
        });
        if (data.verified) {
          finishVerified(mobileE164);
          return;
        }
        markOpenedWhatsApp(mobileE164, data.verification, data.whatsappUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate code');
      } finally {
        setLoading(false);
      }
    },
    [mobileE164, nationalValid, countryDial, customerName, finishVerified, markOpenedWhatsApp],
  );

  useEffect(() => {
    if (!open || verified) return;
    if (autoStartedRef.current) return;
    const seed = initialNationalNumber.replace(/\D/g, '').slice(-10);
    const dial = initialCountryDial || defaultCountry.dial;
    const seedE164 = toE164(dial, seed);
    const seedValid = dial === '91' ? isValidIndianMobile(normalizeMobile(seed)) : Boolean(seedE164);
    if (!seedValid || !seedE164) return;
    autoStartedRef.current = true;
    setLoading(true);
    setError('');
    void prepareCheckoutVerification(seedE164, { customerName })
      .then((data) => {
        if (data.verified) {
          finishVerified(seedE164);
          return;
        }
        markOpenedWhatsApp(seedE164, data.verification, data.whatsappUrl);
      })
      .catch((err) => {
        autoStartedRef.current = false;
        setError(err instanceof Error ? err.message : 'Failed to generate code');
      })
      .finally(() => setLoading(false));
  }, [open, verified, initialNationalNumber, initialCountryDial, defaultCountry.dial, customerName, finishVerified, markOpenedWhatsApp]);

  function openWhatsApp() {
    if (!whatsappUrl || !mobileE164 || !verification) return;
    markOpenedWhatsApp(mobileE164, verification, whatsappUrl);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold">Verify Your WhatsApp Number</h2>
            <p className="text-sm text-gray-500 mt-1">
              Send the WhatsApp message from the same number you entered. We confirm when that message arrives.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {verified ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
              <p className="font-semibold text-green-700">WhatsApp Verified Successfully</p>
              <p className="text-sm text-gray-500">Placing your order…</p>
            </div>
          ) : !pending || !verification ? (
            <>
              <p className="text-sm text-gray-600">
                Send a one-time WhatsApp code so we can confirm your number. After you send it, come back and your order continues.
              </p>

              <div>
                <Label>Mobile Number *</Label>
                <div className="flex gap-2 mt-1">
                  <select
                    value={countryDial}
                    onChange={(e) => setCountryDial(e.target.value)}
                    className="border rounded-lg px-2 py-2 text-sm bg-white min-w-[110px]"
                  >
                    {DEFAULT_COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.dial}>
                        {c.flag} +{c.dial}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={nationalNumber}
                    onChange={(e) => {
                      const digits = stripPhoneInput(e.target.value);
                      setNationalNumber(countryDial === '91' ? digits.slice(0, 10) : digits.slice(0, 14));
                    }}
                    placeholder={countryDial === '91' ? '9876543210' : '412345678'}
                    inputMode="numeric"
                    maxLength={countryDial === '91' ? 10 : 14}
                    className="flex-1"
                  />
                </div>
                {mobileE164 && nationalValid && (
                  <p className="text-xs text-gray-500 mt-1">WhatsApp: {formatE164Display(mobileE164)}</p>
                )}
                {nationalNumber && !nationalValid && (
                  <p className="text-xs text-red-600 mt-1">
                    {countryDial === '91'
                      ? 'Enter a valid 10-digit mobile starting with 6–9'
                      : 'Enter a valid mobile number'}
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                type="button"
                className="w-full bg-[#25D366] hover:bg-[#1ebe57] text-white gap-2"
                disabled={loading || !mobileE164 || !nationalValid}
                onClick={() => generateCode(false)}
              >
                <MessageCircle className="w-5 h-5" />
                {loading ? 'Opening…' : 'Open WhatsApp to Verify'}
              </Button>
            </>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-sm font-medium text-amber-900">Send from this number, then wait here</p>
                <p className="text-xs text-amber-700 mt-1">
                  A different WhatsApp account cannot verify this number. Keep this page open after you send the code.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-center space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Verification Code</p>
                <p className="text-2xl font-bold tracking-widest">{verification.verificationCode}</p>
                <p className="text-sm text-gray-600">{formatE164Display(verification.mobile)}</p>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full bg-[#25D366] hover:bg-[#1ebe57] text-white gap-2"
                  onClick={openWhatsApp}
                >
                  <MessageCircle className="w-5 h-5" />
                  Open WhatsApp Again
                </Button>
                <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={() => void acknowledgeSent()}>
                  I&apos;ve Sent the Message — Continue
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-500"
                  disabled={loading}
                  onClick={() => generateCode(true)}
                >
                  Generate New Code
                </Button>
                <Button type="button" variant="ghost" className="w-full text-red-500" onClick={onClose}>
                  Cancel
                </Button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
