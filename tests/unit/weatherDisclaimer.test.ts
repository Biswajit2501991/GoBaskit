import {
  applyWeatherObservation,
  DEFAULT_WEATHER_DISCLAIMER_MESSAGE,
  isRainWeatherCode,
  isRainingFromOpenMeteo,
  isWeatherDisclaimerVisible,
  parseWeatherDisclaimer,
  WEATHER_HOLD_MS,
} from '@/lib/weatherDisclaimer';

describe('weather disclaimer visibility', () => {
  const base = parseWeatherDisclaimer({
    mode: 'auto',
    rainDetected: false,
    rainHoldUntil: null,
  });

  it('shows when staff force the notice on, even without rain', () => {
    expect(isWeatherDisclaimerVisible({ ...base, mode: 'force_on' })).toBe(true);
  });

  it('hides when staff force the notice off, even if rain was detected', () => {
    expect(
      isWeatherDisclaimerVisible({ ...base, mode: 'force_off', rainDetected: true }),
    ).toBe(false);
  });

  it('shows in auto mode while rain is detected or the hold window is open', () => {
    expect(isWeatherDisclaimerVisible({ ...base, rainDetected: true })).toBe(true);
    expect(
      isWeatherDisclaimerVisible({ ...base, rainHoldUntil: Date.now() + 60_000 }),
    ).toBe(true);
    expect(
      isWeatherDisclaimerVisible({ ...base, rainHoldUntil: Date.now() - 1_000 }),
    ).toBe(false);
  });
});

describe('Open-Meteo rain detection', () => {
  it('treats drizzle, rain, showers, and thunderstorms as rain', () => {
    expect(isRainWeatherCode(51)).toBe(true);
    expect(isRainWeatherCode(61)).toBe(true);
    expect(isRainWeatherCode(80)).toBe(true);
    expect(isRainWeatherCode(95)).toBe(true);
    expect(isRainWeatherCode(0)).toBe(false);
    expect(isRainWeatherCode(3)).toBe(false);
  });

  it('flags current rain or high probability in the next hours', () => {
    expect(
      isRainingFromOpenMeteo({ current: { weather_code: 61, precipitation: 0, rain: 0 } }),
    ).toBe(true);
    const now = new Date('2026-09-01T12:00:00+05:30');
    expect(
      isRainingFromOpenMeteo(
        {
          hourly: {
            time: ['2026-09-01T13:00:00+05:30', '2026-09-01T20:00:00+05:30'],
            precipitation_probability: [75, 10],
            precipitation: [0, 0],
            weather_code: [1, 1],
          },
        },
        now,
      ),
    ).toBe(true);
    expect(
      isRainingFromOpenMeteo(
        {
          current: { weather_code: 1, precipitation: 0, rain: 0 },
          hourly: {
            time: ['2026-09-01T13:00:00+05:30'],
            precipitation_probability: [20],
            precipitation: [0],
            weather_code: [1],
          },
        },
        now,
      ),
    ).toBe(false);
  });
});

describe('weather observation merge', () => {
  it('keeps previous rain state when the forecast fetch fails', () => {
    const current = parseWeatherDisclaimer({
      rainDetected: true,
      rainHoldUntil: 9_999_999,
      message: DEFAULT_WEATHER_DISCLAIMER_MESSAGE,
    });
    const next = applyWeatherObservation(current, {
      ok: false,
      raining: false,
      condition: 'clear',
    });
    expect(next.rainDetected).toBe(true);
    expect(next.rainHoldUntil).toBe(9_999_999);
    expect(next.lastFetchOk).toBe(false);
  });

  it('sets a hold window when rain is detected', () => {
    const now = 1_000_000;
    const next = applyWeatherObservation(
      parseWeatherDisclaimer({ rainDetected: false }),
      { ok: true, raining: true, condition: 'rain' },
      now,
    );
    expect(next.rainDetected).toBe(true);
    expect(next.rainHoldUntil).toBe(now + WEATHER_HOLD_MS);
    expect(next.lastFetchOk).toBe(true);
  });

  it('does not clear the hold when rain stops so the banner does not flicker', () => {
    const now = 1_000_000;
    const next = applyWeatherObservation(
      parseWeatherDisclaimer({ rainDetected: true, rainHoldUntil: now + 50_000 }),
      { ok: true, raining: false, condition: 'clear' },
      now,
    );
    expect(next.rainDetected).toBe(false);
    expect(next.rainHoldUntil).toBe(now + 50_000);
  });
});
