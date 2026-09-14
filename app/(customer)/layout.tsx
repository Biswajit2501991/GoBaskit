import { SettingsService } from '@/services/SettingsService';
import { StorefrontRatingHydrator } from '@/components/Header/StorefrontRatingHydrator';

export const dynamic = 'force-dynamic';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const config = await SettingsService.getStoreConfig();
  const rating = await SettingsService.getPublicStorefrontRating();
  return (
    <StorefrontRatingHydrator
      rating={rating}
      homepageConfig={config.homepageConfig}
      weatherDisclaimer={config.weatherDisclaimer}
    >
      {children}
    </StorefrontRatingHydrator>
  );
}
