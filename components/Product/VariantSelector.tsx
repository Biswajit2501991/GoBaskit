'use client';

import { useMemo, useState } from 'react';
import { useCartStore, cartLineKey } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { useProductVariants } from '@/hooks/useProductVariants';
import { variantLabel, variantImageUrl, variantSizeLabel } from '@/utils/variant';
import { Button } from '@/components/ui/button';
import VariantDrawer from './VariantDrawer';
import type { ProductOption, ProductVariant, ProductWithCategory } from '@/types';

type AddItemFn = (item: Parameters<ReturnType<typeof useCartStore.getState>['addItem']>[0]) => void;

interface VariantSelectorProps {
  product: ProductWithCategory;
  className?: string;
  size?: 'sm' | 'lg';
  label?: string;
  fullWidth?: boolean;
}

export function addVariantToCart(add: AddItemFn, product: ProductWithCategory, variant: ProductVariant) {
  if (variant.stock <= 0) return;
  const size = variantSizeLabel(variant);
  add({
    productId: product.id,
    variantId: variant.id,
    name: product.name,
    variantLabel: variantLabel(variant),
    sku: variant.sku ?? null,
    price: variant.price,
    mrp: variant.mrp ?? null,
    unit: size || product.unit,
    imageUrl: variantImageUrl(variant, product),
    stock: variant.stock,
  });
}

/** Add either the base product or a specific variant, based on the option. */
export function addOptionToCart(
  add: AddItemFn,
  product: ProductWithCategory,
  option: ProductOption,
  variants: ProductVariant[],
) {
  if (!option.inStock || option.stock <= 0) return;

  if (!option.variantId) {
    add({
      productId: product.id,
      name: product.name,
      price: product.price,
      mrp: product.actualPrice ?? null,
      unit: product.unit,
      imageUrl: product.imageUrl,
      stock: product.stock,
    });
    return;
  }
  const variant = variants.find((v) => v.id === option.variantId);
  if (variant) addVariantToCart(add, product, variant);
}

export default function VariantSelector({
  product,
  className = '',
  size = 'sm',
  label,
  fullWidth = false,
}: VariantSelectorProps) {
  const [open, setOpen] = useState(false);
  const hydrated = useCartHydrated();
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const { variants, options, optionsLabel } = useProductVariants(product);
  const buttonLabel = label ?? optionsLabel;
  const anyInStock = options.some((o) => o.inStock);

  const cartQtyByKey = useMemo(() => {
    const map: Record<string, number> = {};
    if (!hydrated) return map;
    for (const o of options) {
      const line = items.find(
        (i) => cartLineKey(i.productId, i.variantId) === cartLineKey(product.id, o.variantId),
      );
      if (line) map[o.key] = line.quantity;
    }
    return map;
  }, [hydrated, items, options, product.id]);

  function handleAdd(option: ProductOption) {
    if (!option.inStock) return;
    addOptionToCart(addItem, product, option, variants);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
        className={
          className ||
          (fullWidth
            ? 'w-full'
            : 'text-[10px] uppercase tracking-wide h-6 px-2 min-w-[2.75rem] shrink-0')
        }
      >
        {anyInStock ? buttonLabel : buttonLabel || 'VIEW'}
      </Button>

      <VariantDrawer
        open={open}
        productName={product.name}
        options={options}
        cartQtyByKey={cartQtyByKey}
        onAdd={handleAdd}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
