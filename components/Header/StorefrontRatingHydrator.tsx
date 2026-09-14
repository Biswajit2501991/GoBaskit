'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useConfigStore, type HomepageConfig } from '@/store/configStore';
import type { StorefrontRatingPublic } from '@/lib/storefrontRating';
import type { WeatherDisclaimerPublic } from '@/lib/weatherDisclaimer';

export type StorefrontBootstrap = {
  storefrontRating: StorefrontRatingPublic;
  homepageConfig: HomepageConfig;
  weatherDisclaimer: WeatherDisclaimerPublic;
};

const StorefrontBootstrapContext = createContext<StorefrontBootstrap | null>(null);

/** Server snapshot so theme, offer code, and rating paint with the first HTML. */
export function StorefrontRatingHydrator({
  rating,
  homepageConfig,
  weatherDisclaimer,
  children,
}: {
  rating: StorefrontRatingPublic;
  homepageConfig: HomepageConfig;
  weatherDisclaimer: WeatherDisclaimerPublic;
  children: ReactNode;
}) {
  return (
    <StorefrontBootstrapContext.Provider
      value={{ storefrontRating: rating, homepageConfig, weatherDisclaimer }}
    >
      {children}
    </StorefrontBootstrapContext.Provider>
  );
}

export function useStorefrontRating(): StorefrontRatingPublic {
  const fromServer = useContext(StorefrontBootstrapContext)?.storefrontRating;
  const loaded = useConfigStore((s) => s.loaded);
  const fromClient = useConfigStore((s) => s.storefrontRating);
  if (loaded) return fromClient;
  return fromServer ?? fromClient;
}

export function useStorefrontHomepageConfig(): HomepageConfig {
  const fromServer = useContext(StorefrontBootstrapContext)?.homepageConfig;
  const loaded = useConfigStore((s) => s.loaded);
  const fromClient = useConfigStore((s) => s.homepageConfig);
  if (loaded) return fromClient;
  return fromServer ?? fromClient;
}

export function useStorefrontWeather(): WeatherDisclaimerPublic {
  const fromServer = useContext(StorefrontBootstrapContext)?.weatherDisclaimer;
  const loaded = useConfigStore((s) => s.loaded);
  const fromClient = useConfigStore((s) => s.weatherDisclaimer);
  if (loaded) return fromClient;
  return fromServer ?? fromClient;
}
