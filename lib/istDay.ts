const IST = 'Asia/Kolkata';

export function istYmd(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/** Inclusive IST calendar day as UTC instants. */
export function istDayRange(ymd: string): { from: Date; to: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const from = new Date(`${ymd}T00:00:00+05:30`);
  const to = new Date(`${ymd}T23:59:59.999+05:30`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return { from, to };
}

export function istRangeFromTo(fromYmd: string, toYmd: string): { from: Date; to: Date } | null {
  const start = istDayRange(fromYmd);
  const end = istDayRange(toYmd);
  if (!start || !end) return null;
  if (start.from.getTime() > end.to.getTime()) return null;
  return { from: start.from, to: end.to };
}
