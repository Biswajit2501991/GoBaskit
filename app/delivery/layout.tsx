import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/admin-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'GoBaskit Delivery',
    statusBarStyle: 'default',
  },
};

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
