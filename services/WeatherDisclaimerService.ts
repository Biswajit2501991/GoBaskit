import { coordsForWeatherPin, isRainingFromOpenMeteo } from '@/lib/weatherDisclaimer';
import { SettingsService } from '@/services/SettingsService';

const OPEN_METEO_TIMEOUT_MS = 8000;

export const WeatherDisclaimerService = {
  async refreshFromForecast(): Promise<{ raining: boolean; fetchOk: boolean }> {
    const config = await SettingsService.getStoreConfig();
    const { latitude, longitude } = coordsForWeatherPin(config.weatherDisclaimer.pin);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=precipitation,rain,weather_code` +
      `&hourly=precipitation,precipitation_probability,weather_code` +
      `&forecast_days=1&timezone=Asia%2FKolkata`;

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(OPEN_METEO_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        await SettingsService.applyWeatherObservation({
          ok: false,
          raining: config.weatherDisclaimer.rainDetected,
          condition: config.weatherDisclaimer.lastCondition,
        });
        return { raining: config.weatherDisclaimer.rainDetected, fetchOk: false };
      }
      const payload = (await res.json()) as Parameters<typeof isRainingFromOpenMeteo>[0];
      const raining = isRainingFromOpenMeteo(payload);
      await SettingsService.applyWeatherObservation({
        ok: true,
        raining,
        condition: raining ? 'rain' : 'clear',
      });
      return { raining, fetchOk: true };
    } catch (err) {
      console.error('[weather-disclaimer] forecast fetch failed', err);
      await SettingsService.applyWeatherObservation({
        ok: false,
        raining: config.weatherDisclaimer.rainDetected,
        condition: config.weatherDisclaimer.lastCondition,
      });
      return { raining: config.weatherDisclaimer.rainDetected, fetchOk: false };
    }
  },
};
