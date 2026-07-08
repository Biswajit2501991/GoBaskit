export function resolvePublicImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  // Relative upload paths are served at runtime via app/uploads/[...path]/route.ts
  if (url.startsWith('/uploads/')) return url;
  return url;
}

/**
 * Returns an image URL sized for the context it's shown in. Our own uploads
 * support on-the-fly resizing via a `?w=` query (handled by the uploads
 * route), which drastically cuts bytes for thumbnails/cards. External images
 * (http/https) are returned unchanged since we can't resize them.
 */
export function sizedImageUrl(url: string | null | undefined, width: number): string {
  const resolved = resolvePublicImageUrl(url);
  if (!resolved) return '';
  // Our own uploads are resized on the fly by the /img route. We must NOT reuse
  // the /uploads path here: files in public/uploads are static-served and would
  // ignore the ?w= query, returning the full-size image.
  if (resolved.startsWith('/uploads/')) {
    return `/img/${resolved.slice('/uploads/'.length)}?w=${Math.round(width)}`;
  }
  return resolved;
}

