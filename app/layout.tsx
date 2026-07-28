import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { STORE_NAME, SITE_URL } from '@/constants';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
