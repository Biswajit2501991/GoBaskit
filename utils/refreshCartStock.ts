import { useCartStore, itemLineKey } from '@/store/cartStore';

type ProductStockPayload = {
  id: string;
  stock: number;
  variants?: Array<{ id: string; stock: number }>;
};

/**
 * Refresh cart line stock from live product APIs so customers see Out of stock
 * before checkout instead of failing at place-order.
 */
export async function refreshCartStockFromServer(): Promise<void> {
  const items = useCartStore.getState().items;
  if (!items.length) return;

  const productIds = [...new Set(items.map((i) => i.productId))];
  const results = await Promise.all(
    productIds.map(async (id) => {
      try {
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) return null;
        return (await res.json()) as ProductStockPayload;
      } catch {
        return null;
      }
    }),
  );

  const updates: Array<{ productId: string; variantId?: string | null; stock: number }> = [];
  for (const product of results) {
    if (!product?.id) continue;
    const lines = items.filter((i) => i.productId === product.id);
    for (const line of lines) {
      if (line.variantId) {
        const variant = product.variants?.find((v) => v.id === line.variantId);
        updates.push({
          productId: product.id,
          variantId: line.variantId,
          stock: variant?.stock ?? 0,
        });
      } else {
        updates.push({
          productId: product.id,
          variantId: null,
          stock: product.stock ?? 0,
        });
      }
    }
  }

  if (updates.length) {
    useCartStore.getState().syncLiveStock(updates);
  }
}

export function cartHasOutOfStockItems(): boolean {
  return useCartStore.getState().items.some((i) => i.stock <= 0 || i.quantity > i.stock);
}

export function outOfStockCartKeys(): string[] {
  return useCartStore
    .getState()
    .items.filter((i) => i.stock <= 0 || i.quantity > i.stock)
    .map((i) => itemLineKey(i));
}
