import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { STORE_NAME, SITE_URL } from '@/constants';
import { parseSeasonalThemeId } from '@/constants/seasonalThemes';
import { SettingsService } from '@/services/SettingsService';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });

/** Live seasonal skin on first HTML — do not cache a stale data-theme. */
export const dynamic = 'force-dynamic';

const title = `${STORE_NAME} — Groceries delivered in minutes`;
const description = 'Order groceries and essentials online. Fast delivery, cash on delivery, order via WhatsApp.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  keywords: ['grocery', 'online shopping', 'delivery', 'GoBaskit'],
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'GoBaskit',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/icon-192.png',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: STORE_NAME,
    title,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

async function resolveSeasonalHtmlTheme(): Promise<string | undefined> {
  try {
    const pathname = (await headers()).get('x-pathname') ?? '';
    if (pathname.startsWith('/admin')) return undefined;
    const config = await SettingsService.getStoreConfig();
    if (config.homepageConfig.seasonalThemeEnabled === true) {
      return parseSeasonalThemeId(config.homepageConfig.seasonalThemeId);
    }
  } catch {
    /* Leave html without data-theme; client applies it after /api/config. */
  }
  return undefined;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const seasonalTheme = await resolveSeasonalHtmlTheme();

  return (
    <html
      lang="en"
      className={dmSans.variable}
      {...(seasonalTheme ? { 'data-theme': seasonalTheme } : {})}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
