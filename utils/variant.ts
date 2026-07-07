import type { ProductVariant } from '@/types';

export const VARIANT_UNITS = ['g', 'kg', 'ml', 'L', 'Pack', 'Piece'] as const;
export type VariantUnit = (typeof VARIANT_UNITS)[number];

/** Human label for a variant, e.g. "Aashirvaad 2kg" or "Nivea Soft 100ml". */
export function variantLabel(variant: {
  brand?: string | null;
  variantName?: string | null;
  weight?: string | null;
  unit?: string | null;
}): string {
  const size = [variant.weight, variant.unit]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .join('');
  const parts = [variant.brand?.trim(), variant.variantName?.trim(), size].filter(Boolean);
  return parts.join(' ').trim() || 'Option';
}

export function activeVariants<T extends { isActive: boolean; sortOrder: number }>(variants: T[]): T[] {
  return [...variants]
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function variantIsInStock(variant: { stock: number; isActive: boolean }): boolean {
  return variant.isActive && variant.stock > 0;
}

/** Lowest active-variant price for "From ₹x" display. Returns null when none. */
export function minVariantPrice(variants: Pick<ProductVariant, 'price' | 'isActive'>[]): number | null {
  const prices = variants.filter((v) => v.isActive).map((v) => v.price);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}
