import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/shop-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'GoBasket Shop',
    statusBarStyle: 'default',
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
