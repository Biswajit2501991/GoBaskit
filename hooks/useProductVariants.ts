'use client';

import { useMemo } from 'react';
import {
  getActiveVariants,
  hasVariants as productHasVariants,
  minVariantPrice,
  optionsButtonLabel,
  selectedVariant,
} from '@/utils/variant';
import type { ProductVariant, ProductWithCategory } from '@/types';

export function useProductVariants(product: ProductWithCategory | null | undefined) {
  return useMemo(() => {
    const variants = getActiveVariants(product?.variants);
    const showOptions = productHasVariants(product ?? { variants: [] });
    return {
      variants,
      showOptions,
      optionsLabel: optionsButtonLabel(variants.length),
      fromPrice: minVariantPrice(variants),
    };
  }, [product?.variants, product?.hasVariants]);
}

export function useSelectedVariant(
  variants: ProductVariant[],
  selectedId: string | null | undefined
) {
  return useMemo(
    () => selectedVariant(variants, selectedId) ?? variants[0] ?? null,
    [variants, selectedId]
  );
}
