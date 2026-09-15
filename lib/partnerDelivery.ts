export type PartnerDeliveryConfig = {
  enabled: boolean;
};

export const DEFAULT_PARTNER_DELIVERY: PartnerDeliveryConfig = {
  enabled: false,
};

export function parsePartnerDelivery(raw: unknown): PartnerDeliveryConfig {
  if (raw === true || raw === 'true') return { enabled: true };
  if (raw && typeof raw === 'object' && (raw as { enabled?: unknown }).enabled === true) {
    return { enabled: true };
  }
  return { enabled: false };
}
