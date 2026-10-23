'use client';

import { BRAND_MARK_SRC } from '@/constants';
import { useConfigStore } from '@/store/configStore';
import { resolvePublicImageUrl } from '@/utils/image';

/** Logo saved under Branding, or the built-in GoBasketkaro logo before config loads. */
export function useBrandLogoUrl() {
  const stored = useConfigStore((s) => s.homepageConfig.loginLogoUrl);
  const url = (stored || '').trim() || BRAND_MARK_SRC;
  return resolvePublicImageUrl(url) || BRAND_MARK_SRC;
}
