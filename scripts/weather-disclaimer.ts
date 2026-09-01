#!/usr/bin/env tsx
import { WeatherDisclaimerService } from '../services/WeatherDisclaimerService';

async function main() {
  const result = await WeatherDisclaimerService.refreshFromForecast();
  console.log(
    `[weather-disclaimer] fetchOk=${result.fetchOk} raining=${result.raining}`,
  );
}

main()
  .catch((err) => {
    console.error('[weather-disclaimer] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import('../lib/prisma');
    await prisma.$disconnect();
  });
