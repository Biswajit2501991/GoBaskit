import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/constants';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ['', '/cart', '/checkout'];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: route === '' ? 1 : 0.7,
  }));
}
