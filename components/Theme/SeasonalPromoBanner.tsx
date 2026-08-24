'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useConfigStore } from '@/store/configStore';
import { parseSeasonalThemeId, SEASONAL_THEME_COPY } from '@/constants/seasonalThemes';

/**
 * Festive promo strip — displays copy + coupon code for one-tap copy.
 * Does not auto-apply discounts; customer still verifies the code in cart.
 */
export default function SeasonalPromoBanner() {
  const loaded = useConfigStore((s) => s.loaded);
  const homepageConfig = useConfigStore((s) => s.homepageConfig);
  const [copied, setCopied] = useState(false);

  const show =
    loaded &&
    homepageConfig.seasonalThemeEnabled === true &&
    homepageConfig.seasonalPromoEnabled === true;

  if (!show) return null;

  const themeCopy = SEASONAL_THEME_COPY[parseSeasonalThemeId(homepageConfig.seasonalThemeId)];
  const code = (homepageConfig.seasonalPromoCode || 'FREEDOM10').trim().toUpperCase();
  const title = homepageConfig.seasonalPromoTitle || themeCopy.promoTitle;
  const subtitle = homepageConfig.seasonalPromoSubtitle || themeCopy.promoSubtitle;
  const cta = homepageConfig.seasonalPromoCtaLabel || 'Copy code';

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div className="seasonal-promo-banner mb-4 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <p className="seasonal-promo-eyebrow text-[11px] font-semibold uppercase tracking-wider">
          {title}
        </p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5">
          Use code{' '}
          <span className="seasonal-promo-code font-mono tracking-wide text-blinkit-green">
            {code}
          </span>
        </p>
        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blinkit-green text-white text-xs font-semibold px-3.5 py-2 hover:bg-blinkit-green-dark transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            {cta}
          </>
        )}
      </button>
    </div>
  );
}
