'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_COUNTRY_OPTIONS, VERIFICATION_POLL_INTERVAL_MS } from '@/constants/whatsappVerification';
import {
  detectCountryFromBrowser,
  formatE164Display,
  stripPhoneInput,
  toE164,
} from '@/utils/phone';
import { openWhatsAppUrl } from '@/utils/whatsapp';

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

  useEffect(() => {
    if (!open) return;
    setError('');
    setVerified(false);
    setPending(false);
    setVerification(null);
    setWhatsappUrl(null);
    setNationalNumber(initialNationalNumber);
    setCountryDial(initialCountryDial || defaultCountry.dial);
  }, [open, initialNationalNumber, initialCountryDial, defaultCountry.dial]);

  useEffect(() => {
    if (!open || !pending || !mobileE164 || verified) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/customer/verification/status?mobile=${encodeURIComponent(mobileE164)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.verified) {
          setVerified(true);
          setPending(false);
          setTimeout(() => onVerified(mobileE164), 1200);
        } else if (data.verification) {
          setVerification(data.verification);
        }
      } catch {
        /* ignore */
      }
    };

    poll();
    const timer = setInterval(poll, VERIFICATION_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [open, pending, mobileE164, verified, onVerified]);

  async function generateCode(forceNew = false) {
    if (!mobileE164) {
      setError('Enter a valid mobile number with country code');
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
          customerName,
          forceNew,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to generate code');
        return;
      }
      if (data.verified) {
        setVerified(true);
        setTimeout(() => onVerified(mobileE164), 800);
        return;
      }
      setVerification(data.verification);
      setWhatsappUrl(data.whatsappUrl ?? null);
      setPending(true);
      if (data.whatsappUrl) {
        await fetch('/api/customer/verification/opened', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobile: mobileE164,
            verificationId: data.verification?.id,
          }),
        }).catch(() => {});
        openWhatsAppUrl(data.whatsappUrl);
      }
    } finally {
      setLoading(false);
    }
  }

  async function openWhatsApp() {
    if (!whatsappUrl || !mobileE164) return;
    await fetch('/api/customer/verification/opened', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: mobileE164,
        verificationId: verification?.id,
      }),
    }).catch(() => {});
    openWhatsAppUrl(whatsappUrl);
  }

  async function acknowledgeSent() {
    if (!mobileE164) return;
    await fetch('/api/customer/verification/sent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: mobileE164,
        verificationId: verification?.id,
      }),
    }).catch(() => {});
    setPending(true);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold">Verify Your WhatsApp Number</h2>
            <p className="text-sm text-gray-500 mt-1">
              One-time verification — takes less than 10 seconds.
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
              <p className="text-sm text-gray-500">Continuing to checkout...</p>
            </div>
          ) : !pending || !verification ? (
            <>
              <p className="text-sm text-gray-600">
                To place your order, please verify your WhatsApp number. We&apos;ll send a code via WhatsApp — no SMS or paid API.
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
                    onChange={(e) => setNationalNumber(stripPhoneInput(e.target.value))}
                    placeholder="412345678"
                    inputMode="numeric"
                    className="flex-1"
                  />
                </div>
                {mobileE164 && (
                  <p className="text-xs text-gray-500 mt-1">Stored as {formatE164Display(mobileE164)}</p>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                type="button"
                className="w-full bg-[#25D366] hover:bg-[#1ebe57] text-white gap-2"
                disabled={loading || !mobileE164}
                onClick={() => generateCode(false)}
              >
                <MessageCircle className="w-5 h-5" />
                {loading ? 'Generating...' : 'Open WhatsApp to Verify'}
              </Button>
            </>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-sm font-medium text-amber-900">Waiting for verification...</p>
                <p className="text-xs text-amber-700 mt-1">We&apos;ll confirm once you send the WhatsApp message.</p>
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
                <Button type="button" variant="outline" className="w-full" onClick={acknowledgeSent}>
                  I&apos;ve Sent the Message
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
