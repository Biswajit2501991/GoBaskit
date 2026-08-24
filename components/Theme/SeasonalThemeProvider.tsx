'use client';

import { useEffect } from 'react';
import { useConfigStore } from '@/store/configStore';
import { isSeasonalThemeId } from '@/constants/seasonalThemes';

/**
 * Applies or removes `data-theme` on <html> from homepageConfig.
 * Presentation only — no cart/checkout side effects.
 */
export default function SeasonalThemeProvider() {
  const seasonalThemeEnabled = useConfigStore((s) => s.homepageConfig.seasonalThemeEnabled);
  const seasonalThemeId = useConfigStore((s) => s.homepageConfig.seasonalThemeId);

  useEffect(() => {
    const root = document.documentElement;
    if (seasonalThemeEnabled && isSeasonalThemeId(seasonalThemeId)) {
      root.dataset.theme = seasonalThemeId;
    } else {
      delete root.dataset.theme;
    }
    return () => {
      delete root.dataset.theme;
    };
  }, [seasonalThemeEnabled, seasonalThemeId]);

  return null;
}
