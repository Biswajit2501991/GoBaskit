'use client';

import { useLayoutEffect } from 'react';
import { useStorefrontHomepageConfig } from '@/components/Header/StorefrontRatingHydrator';
import { isSeasonalThemeId, parseSeasonalThemeId } from '@/constants/seasonalThemes';
import { persistStorefrontPresentation } from '@/utils/storefrontPresentation';

/** Apply festive `data-theme` as soon as the server snapshot is available. */
export default function SeasonalThemeProvider() {
  const homepage = useStorefrontHomepageConfig();
  const seasonalThemeEnabled = homepage.seasonalThemeEnabled === true;
  const seasonalThemeId = parseSeasonalThemeId(homepage.seasonalThemeId);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (seasonalThemeEnabled && isSeasonalThemeId(seasonalThemeId) && seasonalThemeId !== 'normal') {
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
      seasonalThemeId,
    });
  }, [seasonalThemeEnabled, seasonalThemeId]);

  return null;
}
