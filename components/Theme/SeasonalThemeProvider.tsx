'use client';

import { useEffect } from 'react';
import { useConfigStore } from '@/store/configStore';
import { isSeasonalThemeId } from '@/constants/seasonalThemes';
import { persistStorefrontPresentation } from '@/utils/storefrontPresentation';

/**
 * Keeps `data-theme` on <html> in sync with homepageConfig after settings load.
 * Does not clear a server-set theme until live config has arrived.
 */
export default function SeasonalThemeProvider() {
  const loaded = useConfigStore((s) => s.loaded);
  const seasonalThemeEnabled = useConfigStore((s) => s.homepageConfig.seasonalThemeEnabled);
  const seasonalThemeId = useConfigStore((s) => s.homepageConfig.seasonalThemeId);

  useEffect(() => {
    if (!loaded) return;

    const root = document.documentElement;
    if (seasonalThemeEnabled && isSeasonalThemeId(seasonalThemeId)) {
      root.dataset.theme = seasonalThemeId;
      persistStorefrontPresentation({
        seasonalThemeEnabled: true,
        seasonalThemeId,
      });
      return;
    }

    delete root.dataset.theme;
    persistStorefrontPresentation({
      seasonalThemeEnabled: false,
      seasonalThemeId: isSeasonalThemeId(seasonalThemeId) ? seasonalThemeId : 'independence-day',
    });
  }, [loaded, seasonalThemeEnabled, seasonalThemeId]);

  return null;
}
