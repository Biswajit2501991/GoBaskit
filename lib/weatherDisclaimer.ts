export type WeatherDisclaimerMode = 'auto' | 'force_on' | 'force_off';

/** PIN 723121 — Adra, Purulia, West Bengal. */
export const WEATHER_DEFAULT_PIN = '723121';
export const WEATHER_ADRA_COORDS = { latitude: 23.4961, longitude: 86.6753 } as const;
export const WEATHER_HOLD_MS = 60 * 60 * 1000;
/** Auto mode only looks this far ahead. Rain later (for example in 2 hours) stays hidden. */
export const WEATHER_LOOKAHEAD_MS = 30 * 60 * 1000;

export const DEFAULT_WEATHER_DISCLAIMER_MESSAGE =
  'Rain is expected in our delivery area in the next 30 minutes. Your order will still be delivered as soon as we can — weather is just not in our favour. Thank you for your patience.';

export interface WeatherDisclaimerState {
  mode: WeatherDisclaimerMode;
  pin: string;
  message: string;
  rainDetected: boolean;
  /** Epoch ms; keep the banner on after rain stops so it does not flicker. */
  rainHoldUntil: number | null;
  lastCheckedAt: string | null;
  lastCondition: string | null;
  lastFetchOk: boolean;
}

export type WeatherDisclaimerPublic = WeatherDisclaimerState & { visible: boolean };

export const DEFAULT_WEATHER_DISCLAIMER: WeatherDisclaimerState = {
  mode: 'auto',
  pin: WEATHER_DEFAULT_PIN,
  message: DEFAULT_WEATHER_DISCLAIMER_MESSAGE,
  rainDetected: false,
  rainHoldUntil: null,
  lastCheckedAt: null,
  lastCondition: null,
  lastFetchOk: true,
};

export function parseWeatherDisclaimerMode(raw: unknown): WeatherDisclaimerMode {
  const v = String(raw ?? '').trim();
  if (v === 'force_on' || v === 'force_off' || v === 'auto') return v;
  return 'auto';
}

export function isWeatherDisclaimerVisible(
  state: Pick<WeatherDisclaimerState, 'mode' | 'rainDetected' | 'rainHoldUntil'>,
  now = Date.now(),
): boolean {
  if (state.mode === 'force_on') return true;
  if (state.mode === 'force_off') return false;
  if (state.rainDetected) return true;
  if (typeof state.rainHoldUntil === 'number' && state.rainHoldUntil > now) return true;
  return false;
}

export function withWeatherDisclaimerVisible(
  state: WeatherDisclaimerState,
  now = Date.now(),
): WeatherDisclaimerPublic {
  return { ...state, visible: isWeatherDisclaimerVisible(state, now) };
}

export function parseWeatherDisclaimer(raw: unknown): WeatherDisclaimerPublic {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pinDigits = String(src.pin ?? WEATHER_DEFAULT_PIN).replace(/\D/g, '');
  const pin = /^\d{6}$/.test(pinDigits) ? pinDigits : WEATHER_DEFAULT_PIN;
  const message =
    String(src.message ?? '').trim().slice(0, 500) || DEFAULT_WEATHER_DISCLAIMER_MESSAGE;
  const holdRaw = Number(src.rainHoldUntil);
  const rainHoldUntil = Number.isFinite(holdRaw) && holdRaw > 0 ? holdRaw : null;
  const state: WeatherDisclaimerState = {
    mode: parseWeatherDisclaimerMode(src.mode),
    pin,
    message,
    rainDetected: src.rainDetected === true,
    rainHoldUntil,
    lastCheckedAt: typeof src.lastCheckedAt === 'string' ? src.lastCheckedAt : null,
    lastCondition: typeof src.lastCondition === 'string' ? src.lastCondition : null,
    lastFetchOk: src.lastFetchOk !== false,
  };
  return withWeatherDisclaimerVisible(state);
}

export function persistWeatherDisclaimer(state: WeatherDisclaimerState): string {
  const { mode, pin, message, rainDetected, rainHoldUntil, lastCheckedAt, lastCondition, lastFetchOk } =
    state;
  return JSON.stringify({
    mode,
    pin,
    message,
    rainDetected,
    rainHoldUntil,
    lastCheckedAt,
    lastCondition,
    lastFetchOk,
  });
}

export function coordsForWeatherPin(pin: string): { latitude: number; longitude: number } {
  const digits = String(pin).replace(/\D/g, '');
  if (digits === WEATHER_DEFAULT_PIN) return WEATHER_ADRA_COORDS;
  return WEATHER_ADRA_COORDS;
}

/** WMO codes used by Open-Meteo for drizzle, rain, showers, thunderstorms. */
export function isRainWeatherCode(code: unknown): boolean {
  const n = Number(code);
  if (!Number.isFinite(n)) return false;
  return (
    (n >= 51 && n <= 67) ||
    (n >= 80 && n <= 82) ||
    (n >= 95 && n <= 99)
  );
}

export type OpenMeteoForecast = {
  current?: { precipitation?: number; rain?: number; weather_code?: number };
  minutely_15?: {
    time?: string[];
    precipitation?: number[];
    weather_code?: number[];
  };
  hourly?: {
    time?: string[];
    precipitation?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
  };
};

function timeInWindow(iso: string | undefined, nowMs: number, lookbackMs: number, aheadMs: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= nowMs - lookbackMs && t <= nowMs + aheadMs;
}

export function isRainingFromOpenMeteo(payload: OpenMeteoForecast, now = new Date()): boolean {
  const nowMs = now.getTime();
  const current = payload.current;
  if (current) {
    if (isRainWeatherCode(current.weather_code)) return true;
    if (Number(current.precipitation) >= 0.2 || Number(current.rain) >= 0.2) return true;
  }

  const minutely = payload.minutely_15;
  const minuteTimes = minutely?.time;
  if (minuteTimes?.length) {
    for (let i = 0; i < minuteTimes.length; i++) {
      if (!timeInWindow(minuteTimes[i], nowMs, 5 * 60 * 1000, WEATHER_LOOKAHEAD_MS)) continue;
      if (isRainWeatherCode(minutely?.weather_code?.[i])) return true;
      if (Number(minutely?.precipitation?.[i]) >= 0.15) return true;
    }
    return false;
  }

  const hourly = payload.hourly;
  const times = hourly?.time;
  if (!times?.length) return false;

  for (let i = 0; i < times.length; i++) {
    if (!timeInWindow(times[i], nowMs, 20 * 60 * 1000, WEATHER_LOOKAHEAD_MS)) continue;
    if (isRainWeatherCode(hourly?.weather_code?.[i])) return true;
    if (Number(hourly?.precipitation?.[i]) >= 0.4) return true;
    if (Number(hourly?.precipitation_probability?.[i]) >= 70) return true;
  }
  return false;
}

export function applyWeatherObservation(
  current: WeatherDisclaimerState,
  obs: { ok: boolean; raining: boolean; condition: string | null },
  now = Date.now(),
): WeatherDisclaimerState {
  const lastCheckedAt = new Date(now).toISOString();
  if (!obs.ok) {
    return { ...current, lastCheckedAt, lastFetchOk: false };
  }
  if (obs.raining) {
    return {
      ...current,
      rainDetected: true,
      rainHoldUntil: now + WEATHER_HOLD_MS,
      lastCondition: obs.condition,
      lastCheckedAt,
      lastFetchOk: true,
    };
  }
  return {
    ...current,
    rainDetected: false,
    rainHoldUntil: null,
    lastCondition: obs.condition,
    lastCheckedAt,
    lastFetchOk: true,
  };
}
