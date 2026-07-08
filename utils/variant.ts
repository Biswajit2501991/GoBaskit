import type { ProductOption, ProductVariant, ProductWithCategory } from '@/types';

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

export function variantSizeLabel(variant: Pick<ProductVariant, 'weight' | 'unit'>): string {
  return `${variant.weight ?? ''}${variant.unit ?? ''}`.trim();
}

/** Active variants sorted for display (API may already filter; this is defensive). */
export function getActiveVariants(variants: ProductVariant[] | null | undefined): ProductVariant[] {
  if (!variants?.length) return [];
  return [...variants]
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** True when the product has at least one active variant to pick from. */
export function hasVariants(product: Pick<ProductWithCategory, 'hasVariants' | 'variants'>): boolean {
  return getActiveVariants(product.variants).length > 0;
}

/** Button label: "OPTIONS", "1 OPTION", "2 OPTIONS", etc. */
export function optionsButtonLabel(count: number): string {
  if (count <= 0) return 'OPTIONS';
  if (count === 1) return '1 OPTION';
  return `${count} OPTIONS`;
}

/**
 * Build the customer-facing option list. The parent product is always the
 * first option; each active variant follows. Each option carries its OWN
 * name, price, MRP, image, and stock (image falls back to the parent image).
 */
export function buildProductOptions(
  product: Pick<
    ProductWithCategory,
    | 'id'
    | 'name'
    | 'details'
    | 'price'
    | 'actualPrice'
    | 'unit'
    | 'stock'
    | 'status'
    | 'imageUrl'
    | 'healthStarRating'
    | 'variants'
  >,
): ProductOption[] {
  const baseDetails = product.details ?? '';
  const baseRating =
    typeof product.healthStarRating === 'number' &&
    product.healthStarRating >= 1 &&
    product.healthStarRating <= 5
      ? product.healthStarRating
      : null;
  const options: ProductOption[] = [
    {
      key: 'base',
      variantId: null,
      isBase: true,
      name: product.name,
      sizeLabel: product.unit,
      price: product.price,
      mrp: product.actualPrice ?? null,
      imageUrl: product.imageUrl ?? null,
      details: baseDetails,
      healthStarRating: baseRating,
      stock: product.stock,
      inStock: product.stock > 0 && product.status === 'ACTIVE',
    },
  ];

  for (const v of getActiveVariants(product.variants)) {
    const variantRating =
      typeof v.healthStarRating === 'number' &&
      v.healthStarRating >= 1 &&
      v.healthStarRating <= 5
        ? v.healthStarRating
        : baseRating;
    options.push({
      key: v.id,
      variantId: v.id,
      isBase: false,
      name: variantLabel(v),
      sizeLabel: variantSizeLabel(v) || product.unit,
      price: v.price,
      mrp: v.mrp ?? null,
      imageUrl: variantImageUrl(v, product),
      // Fall back to the parent product's details when the option has none.
      details: (v.details ?? '').trim() || baseDetails,
      healthStarRating: variantRating,
      stock: v.stock,
      inStock: v.stock > 0,
    });
  }

  return options;
}

/** Lowest price across all options (parent + active variants). */
export function minOptionPrice(options: ProductOption[]): number | null {
  if (!options.length) return null;
  return Math.min(...options.map((o) => o.price));
}

/** Resolve a variant by id, or null. */
export function selectedVariant(
  variants: ProductVariant[],
  variantId: string | null | undefined
): ProductVariant | null {
  if (!variantId) return null;
  return variants.find((v) => v.id === variantId) ?? null;
}

/** @deprecated Use getActiveVariants */
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

/** Variant image with parent product fallback. */
export function variantImageUrl(
  variant: Pick<ProductVariant, 'imageUrl'>,
  product: Pick<ProductWithCategory, 'imageUrl'>
): string | null {
  return variant.imageUrl ?? product.imageUrl ?? null;
}
