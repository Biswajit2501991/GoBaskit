'use client';

import { useMemo, useState } from 'react';
import { useCartStore, cartLineKey } from '@/store/cartStore';
import { useCartHydrated } from '@/hooks/useCartHydrated';
import { variantLabel } from '@/utils/variant';
import { Button } from '@/components/ui/button';
import VariantDrawer from './VariantDrawer';
import type { ProductVariant, ProductWithCategory } from '@/types';

interface VariantSelectorProps {
  product: ProductWithCategory;
  variants: ProductVariant[];
  className?: string;
  size?: 'sm' | 'lg';
  label?: string;
  fullWidth?: boolean;
}

export function addVariantToCart(
  add: (item: Parameters<ReturnType<typeof useCartStore.getState>['addItem']>[0]) => void,
  product: ProductWithCategory,
  variant: ProductVariant,
) {
  const size = `${variant.weight ?? ''}${variant.unit ?? ''}`.trim();
  add({
    productId: product.id,
    variantId: variant.id,
    name: product.name,
    variantLabel: variantLabel(variant),
    sku: variant.sku ?? null,
    price: variant.price,
    unit: size || product.unit,
    imageUrl: variant.imageUrl ?? product.imageUrl,
    stock: variant.stock,
  });
}

export default function VariantSelector({
  product,
  variants,
  className = '',
  size = 'sm',
  label = 'Choose Option',
  fullWidth = false,
}: VariantSelectorProps) {
  const [open, setOpen] = useState(false);
  const hydrated = useCartHydrated();
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);

  const cartQtyByVariant = useMemo(() => {
    const map: Record<string, number> = {};
    if (!hydrated) return map;
    for (const v of variants) {
      const line = items.find((i) => cartLineKey(i.productId, i.variantId) === cartLineKey(product.id, v.id));
      if (line) map[v.id] = line.quantity;
    }
    return map;
  }, [hydrated, items, variants, product.id]);

  function handleAdd(variant: ProductVariant) {
    addVariantToCart(addItem, product, variant);
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
        {label}
      </Button>

      <VariantDrawer
        open={open}
        productName={product.name}
        variants={variants}
        cartQtyByVariant={cartQtyByVariant}
        onAdd={handleAdd}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
