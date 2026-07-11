export const VERIFICATION_CODE_PREFIX = 'GB';
export const VERIFICATION_CODE_TTL_MINUTES = 10;
export const VERIFICATION_POLL_INTERVAL_MS = 10_000;
/** Login modal waits on WhatsApp approval — poll quickly with the light verificationId path. */
export const LOGIN_VERIFICATION_POLL_INTERVAL_MS = 1_000;
export const VERIFICATION_MAX_ATTEMPTS_PER_DAY = 5;

export const VERIFICATION_AUDIT_ACTIONS = {
  GENERATED: 'verification_generated',
  WHATSAPP_OPENED: 'whatsapp_opened',
  APPROVED: 'verification_approved',
  REJECTED: 'verification_rejected',
  EXPIRED: 'verification_expired',
  SENT_ACK: 'verification_sent_ack',
  DELETED: 'verification_deleted',
} as const;

export const DEFAULT_COUNTRY_OPTIONS = [
  { code: 'IN', dial: '91', label: 'India', flag: '🇮🇳' },
  { code: 'AU', dial: '61', label: 'Australia', flag: '🇦🇺' },
  { code: 'US', dial: '1', label: 'United States', flag: '🇺🇸' },
  { code: 'GB', dial: '44', label: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AE', dial: '971', label: 'UAE', flag: '🇦🇪' },
  { code: 'SG', dial: '65', label: 'Singapore', flag: '🇸🇬' },
] as const;
