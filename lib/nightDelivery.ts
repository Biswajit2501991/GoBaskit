export type NightDeliveryWindow = 'none' | 'tomorrow' | 'after_eight_today';

export type OvernightCheckoutConfig = {
  enabled: boolean;
  /** IST time when the “deliver tomorrow” prompt starts (e.g. 21:00). */
  eveningStart: string;
  /** IST time when the overnight prompt ends (e.g. 07:30). */
  morningCutoff: string;
  /** Promised delivery-from time shown after midnight (e.g. 08:00). */
  morningDeliveryFrom: string;
};

export const DEFAULT_OVERNIGHT_CHECKOUT: OvernightCheckoutConfig = {
  enabled: true,
  eveningStart: '21:00',
  morningCutoff: '07:30',
  morningDeliveryFrom: '08:00',
};

const IST = 'Asia/Kolkata';
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export function parseHhMm(value: string): number | null {
  const match = HH_MM.exec(String(value ?? '').trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function normalizeHhMm(value: string): string | null {
  const minutes = parseHhMm(value);
  if (minutes == null) return null;
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function formatClockLabel(hhmm: string): string {
  const minutes = parseHhMm(hhmm);
  if (minutes == null) return hhmm;
  const hour24 = Math.floor(minutes / 60);
  const min = minutes % 60;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return min === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(min).padStart(2, '0')} ${ampm}`;
}

export function parseOvernightCheckout(raw: unknown): OvernightCheckoutConfig {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const eveningStart =
    normalizeHhMm(String(src.eveningStart ?? '')) ?? DEFAULT_OVERNIGHT_CHECKOUT.eveningStart;
  const morningCutoff =
    normalizeHhMm(String(src.morningCutoff ?? '')) ?? DEFAULT_OVERNIGHT_CHECKOUT.morningCutoff;
  const morningDeliveryFrom =
    normalizeHhMm(String(src.morningDeliveryFrom ?? '')) ??
    DEFAULT_OVERNIGHT_CHECKOUT.morningDeliveryFrom;
  const eveningMins = parseHhMm(eveningStart)!;
  const morningMins = parseHhMm(morningCutoff)!;
  if (eveningMins <= morningMins) {
    return { ...DEFAULT_OVERNIGHT_CHECKOUT, enabled: src.enabled !== false };
  }
  return {
    enabled: src.enabled !== false,
    eveningStart,
    morningCutoff,
    morningDeliveryFrom,
  };
}

export function getIstMinutesSinceMidnight(now?: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now ?? new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** Evening start–midnight IST → tomorrow. Midnight–morning cutoff IST → after morningDeliveryFrom today. */
export function nightDeliveryWindow(
  now?: Date,
  config: OvernightCheckoutConfig = DEFAULT_OVERNIGHT_CHECKOUT,
): NightDeliveryWindow {
  const cfg = parseOvernightCheckout(config);
  if (!cfg.enabled) return 'none';
  const minutes = getIstMinutesSinceMidnight(now);
  const evening = parseHhMm(cfg.eveningStart) ?? 21 * 60;
  const morning = parseHhMm(cfg.morningCutoff) ?? 7 * 60 + 30;
  if (minutes >= evening) return 'tomorrow';
  if (minutes < morning) return 'after_eight_today';
  return 'none';
}

export function nightDeliveryCopy(
  window: NightDeliveryWindow,
  config: OvernightCheckoutConfig = DEFAULT_OVERNIGHT_CHECKOUT,
): {
  title: string;
  message: string;
  staffNote: string;
} | null {
  const cfg = parseOvernightCheckout(config);
  const fromLabel = formatClockLabel(cfg.morningDeliveryFrom);
  if (window === 'tomorrow') {
    return {
      title: 'Your order will be delivered tomorrow',
      message:
        'We are not delivering this late tonight. If you Accept, your order will be placed now and delivered tomorrow. Our delivery partner will contact you, or you can track the order from Profile. Decline to cancel and keep your cart.',
      staffNote: 'Customer accepted overnight checkout: deliver tomorrow.',
    };
  }
  if (window === 'after_eight_today') {
    return {
      title: `Items will be delivered after ${fromLabel} today`,
      message: `If you Accept, your order will be placed now and delivered after ${fromLabel} today. Our delivery partner will contact you, or you can track the order from Profile. Decline to cancel and keep your cart.`,
      staffNote: `Customer accepted overnight checkout: deliver after ${fromLabel} today.`,
    };
  }
  return null;
}
