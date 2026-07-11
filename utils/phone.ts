import { DEFAULT_COUNTRY_OPTIONS } from '@/constants/whatsappVerification';
import { isValidIndianMobile, normalizeMobile } from '@/utils/mobile';

export interface CountryOption {
  code: string;
  dial: string;
  label: string;
  flag: string;
}

export function stripPhoneInput(value: string): string {
  return value.replace(/[\s\-()]/g, '').replace(/\D/g, '');
}

export function toE164(countryDial: string, nationalNumber: string): string | null {
  const dial = stripPhoneInput(countryDial);
  const digits = stripPhoneInput(nationalNumber);
  if (!dial || !digits) return null;

  // India: always require a real 10-digit mobile (6–9…). Never strip "91" from a
  // 10-digit national field — that produced truncated numbers like +91 2607158.
  if (dial === '91') {
    const national = normalizeMobile(digits);
    if (!isValidIndianMobile(national)) return null;
    return `+91${national}`;
  }

  let national = digits;
  if (national.startsWith(dial) && national.length - dial.length >= 8) {
    national = national.slice(dial.length);
  }
  if (national.startsWith('0')) {
    national = national.replace(/^0+/, '');
  }
  if (!national || national.length < 8 || national.length > 14) return null;

  return `+${dial}${national}`;
}

export function parseE164(e164: string): { dial: string; national: string } | null {
  const cleaned = e164.trim();
  if (!cleaned.startsWith('+')) return null;
  const digits = cleaned.slice(1).replace(/\D/g, '');
  if (!digits) return null;

  const sorted = [...DEFAULT_COUNTRY_OPTIONS].sort((a, b) => b.dial.length - a.dial.length);
  for (const country of sorted) {
    if (digits.startsWith(country.dial)) {
      return { dial: country.dial, national: digits.slice(country.dial.length) };
    }
  }

  if (digits.length >= 10) {
    return {
      dial: digits.slice(0, Math.min(3, digits.length - 7)),
      national: digits.slice(Math.min(3, digits.length - 7)),
    };
  }
  return null;
}

export function formatE164Display(e164: string): string {
  const parsed = parseE164(e164);
  if (!parsed) return e164;
  return `+${parsed.dial} ${parsed.national}`;
}

/** Map E.164 to checkout form mobile (10-digit Indian when applicable). */
export function e164ToCheckoutMobile(e164: string): string {
  const parsed = parseE164(e164);
  if (!parsed) {
    const fallback = normalizeMobile(e164);
    return isValidIndianMobile(fallback) ? fallback : '';
  }
  if (parsed.dial === '91') {
    return isValidIndianMobile(parsed.national) ? parsed.national : '';
  }
  return parsed.national;
}

export function detectCountryFromE164(e164: string): CountryOption {
  const parsed = parseE164(e164);
  if (!parsed) return DEFAULT_COUNTRY_OPTIONS[0];
  const match = DEFAULT_COUNTRY_OPTIONS.find((c) => c.dial === parsed.dial);
  return match ?? DEFAULT_COUNTRY_OPTIONS[0];
}

export function detectCountryFromBrowser(): CountryOption {
  if (typeof navigator === 'undefined') return DEFAULT_COUNTRY_OPTIONS[0];
  const locale = navigator.language || '';
  const region = locale.split('-')[1]?.toUpperCase();
  if (region) {
    const match = DEFAULT_COUNTRY_OPTIONS.find((c) => c.code === region);
    if (match) return match;
  }
  return DEFAULT_COUNTRY_OPTIONS[0];
}

export function isValidE164(e164: string): boolean {
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return false;
  const parsed = parseE164(e164);
  if (!parsed) return false;
  // Indian numbers must be full 10-digit mobiles.
  if (parsed.dial === '91') return isValidIndianMobile(parsed.national);
  return parsed.national.length >= 8 && parsed.national.length <= 12;
}

export function mobileVariantsFromE164(e164: string): string[] {
  const checkout = e164ToCheckoutMobile(e164);
  const parsed = parseE164(e164);
  const variants = new Set<string>([e164]);
  if (checkout) {
    variants.add(checkout);
    if (parsed?.dial === '91') {
      variants.add(`91${checkout}`);
      variants.add(`+91${checkout}`);
    }
  }
  return [...variants];
}
