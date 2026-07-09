import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { STORE_NAME, SITE_URL } from '@/constants';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });

const title = `${STORE_NAME} — Groceries delivered in minutes`;
const description = 'Order groceries and essentials online. Fast delivery, cash on delivery, order via WhatsApp.';

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
    apple: '/icon-192.png',
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
