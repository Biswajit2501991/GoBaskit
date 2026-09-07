export type NightDeliveryWindow = 'none' | 'tomorrow' | 'after_eight_today';

const IST = 'Asia/Kolkata';
const MINUTES_9PM = 21 * 60;
const MINUTES_730AM = 7 * 60 + 30;

export function getIstMinutesSinceMidnight(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** 9:00 PM–11:59 PM IST → tomorrow. 12:00 AM–7:29 AM IST → after 8 AM today. */
export function nightDeliveryWindow(now: Date = new Date()): NightDeliveryWindow {
  const minutes = getIstMinutesSinceMidnight(now);
  if (minutes >= MINUTES_9PM) return 'tomorrow';
  if (minutes < MINUTES_730AM) return 'after_eight_today';
  return 'none';
}

export function nightDeliveryCopy(window: NightDeliveryWindow): {
  title: string;
  message: string;
  staffNote: string;
} | null {
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
      title: 'Items will be delivered after 8 AM today',
      message:
        'If you Accept, your order will be placed now and delivered after 8 AM today. Our delivery partner will contact you, or you can track the order from Profile. Decline to cancel and keep your cart.',
      staffNote: 'Customer accepted overnight checkout: deliver after 8 AM today.',
    };
  }
  return null;
}
