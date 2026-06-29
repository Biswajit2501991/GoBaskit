import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { STORE_NAME } from '@/constants';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });

export const metadata: Metadata = {
  title: `${STORE_NAME} — Groceries delivered in minutes`,
  description: 'Order groceries and essentials online. Fast delivery, cash on delivery, order via WhatsApp.',
  keywords: ['grocery', 'online shopping', 'delivery', 'GoBaskit'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
