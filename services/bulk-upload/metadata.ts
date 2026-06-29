const META_MARKER = '\n\n---\nMETA:';

export interface ProductMetadata {
  sku?: string;
  subCategory?: string;
  sortOrder?: number;
  gstPercent?: number | null;
  weight?: string;
  tags?: string;
  brand?: string;
  countryOfOrigin?: string;
}

export function embedMetadata(description: string, meta: ProductMetadata): string {
  const base = description.replace(new RegExp(`${META_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*$`), '').trim();
  const payload = JSON.stringify(meta);
  return base ? `${base}${META_MARKER}${payload}` : `${META_MARKER}${payload}`;
}

export function extractMetadata(description: string): ProductMetadata {
  const idx = description.indexOf(META_MARKER);
  if (idx === -1) return {};
  try {
    return JSON.parse(description.slice(idx + META_MARKER.length)) as ProductMetadata;
  } catch {
    return {};
  }
}

export function extractDescriptionText(description: string): string {
  const idx = description.indexOf(META_MARKER);
  return idx === -1 ? description : description.slice(0, idx).trim();
}

export function skuFromDescription(description: string): string | undefined {
  return extractMetadata(description).sku;
}
