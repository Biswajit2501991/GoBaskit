export type DeliveryOtpConfig = {
  enabled: boolean;
};

export const DEFAULT_DELIVERY_OTP: DeliveryOtpConfig = {
  enabled: false,
};

export function parseDeliveryOtp(raw: unknown): DeliveryOtpConfig {
  if (raw === true || raw === 'true') return { enabled: true };
  if (raw && typeof raw === 'object' && (raw as { enabled?: unknown }).enabled === true) {
    return { enabled: true };
  }
  return { enabled: false };
}
