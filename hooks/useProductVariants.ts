'use client';

import { useMemo } from 'react';
import {
  buildProductOptions,
  getActiveVariants,
  minOptionPrice,
  optionsButtonLabel,
  selectedVariant,
} from '@/utils/variant';
import type { ProductOption, ProductVariant, ProductWithCategory } from '@/types';

export function useProductVariants(product: ProductWithCategory | null | undefined) {
  return useMemo(() => {
    const variants = getActiveVariants(product?.variants);
    // Options exist only when there is at least one active variant. The parent
    // product then becomes the first option, so the count is variants + 1.
    const showOptions = variants.length > 0;
    const options: ProductOption[] = showOptions && product ? buildProductOptions(product) : [];
    const optionCount = options.length;
    return {
      variants,
      options,
      showOptions,
      optionCount,
      optionsLabel: optionsButtonLabel(optionCount),
      fromPrice: minOptionPrice(options),
    };
  }, [product]);
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
