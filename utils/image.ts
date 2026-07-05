export function resolvePublicImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads/')) {
    const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gobaskitkaro.com').replace(/\/+$/, '');
    return `${base}${url}`;
  }
  return url;
}

