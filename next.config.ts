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
};

export default nextConfig;
