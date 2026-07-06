export function resolvePublicImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  // Relative upload paths are served at runtime via app/uploads/[...path]/route.ts
  if (url.startsWith('/uploads/')) return url;
  return url;
}

