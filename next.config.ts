import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to serve cross-origin dev assets when the app is
  // accessed through a custom domain / tunnel (e.g. Cloudflare Tunnel).
  // Without this, `next dev` behind a proxy domain blocks dev requests and the
  // client never hydrates/fetches (blank skeletons). For public serving prefer
  // `npm run build && npm run start`.
  allowedDevOrigins: [
    'gobaskitkaro.com',
    'www.gobaskitkaro.com',
    '*.gobaskitkaro.com',
    '*.trycloudflare.com',
  ],
  async headers() {
    // Client-heavy pages must not be cached for a year — stale HTML references
    // old hashed JS chunks after deploy and breaks hydration ("This page couldn't load").
    const noStore = 'private, no-cache, no-store, max-age=0, must-revalidate';
    return [
      { source: '/checkout', headers: [{ key: 'Cache-Control', value: noStore }] },
      { source: '/cart', headers: [{ key: 'Cache-Control', value: noStore }] },
      { source: '/account', headers: [{ key: 'Cache-Control', value: noStore }] },
      { source: '/account/:path*', headers: [{ key: 'Cache-Control', value: noStore }] },
      { source: '/success', headers: [{ key: 'Cache-Control', value: noStore }] },
      { source: '/admin', headers: [{ key: 'Cache-Control', value: noStore }] },
      { source: '/admin/:path*', headers: [{ key: 'Cache-Control', value: noStore }] },
    ];
  },
};

export default nextConfig;
