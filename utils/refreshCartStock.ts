import { useCartStore, itemLineKey } from '@/store/cartStore';
import { useCartUiStore } from '@/store/cartUiStore';

type ProductStockPayload = {
  id: string;
  stock: number;
  status?: string;
  variants?: Array<{ id: string; stock: number; isActive?: boolean }>;
};

export type CartStockRefreshResult = {
  removed: Array<{ name: string; key: string }>;
};

function buildRemovalNotice(removed: Array<{ name: string }>): string {
  if (removed.length === 1) {
    return `${removed[0].name} is out of stock and was removed from your cart.`;
  }
  const preview = removed
    .slice(0, 2)
    .map((r) => r.name)
    .join(', ');
  const more = removed.length > 2 ? ` and ${removed.length - 2} more` : '';
  return `Some items are out of stock and were removed from your cart (${preview}${more}).`;
}

/**
 * Refresh cart line stock from live product APIs, then auto-remove lines that
 * are out of stock (or no longer exist). Shows a one-shot cart notice when
 * anything was removed so customers see it as soon as they open the cart.
 */
export async function refreshCartStockFromServer(): Promise<CartStockRefreshResult> {
  const items = useCartStore.getState().items;
  if (!items.length) return { removed: [] };

  const productIds = [...new Set(items.map((i) => i.productId))];
  const results = await Promise.all(
    productIds.map(async (id) => {
      try {
        const res = await fetch(`/api/products/${id}`);
        if (res.status === 404) {
          // Product deleted — treat every line as unavailable.
          return { id, stock: 0, missing: true as const };
        }
        if (!res.ok) return null;
        return (await res.json()) as ProductStockPayload;
      } catch {
        // Network blip — leave cart untouched to avoid false removals.
        return null;
      }
    }),
  );

  const updates: Array<{ productId: string; variantId?: string | null; stock: number }> = [];
  for (const product of results) {
    if (!product?.id) continue;
    const lines = items.filter((i) => i.productId === product.id);
    const missing = 'missing' in product && product.missing;
    const inactiveProduct =
      !missing && 'status' in product && product.status === 'INACTIVE';

    for (const line of lines) {
      if (missing || inactiveProduct) {
        updates.push({
          productId: product.id,
          variantId: line.variantId ?? null,
          stock: 0,
        });
        continue;
      }

      if (line.variantId) {
        const variant = product.variants?.find((v) => v.id === line.variantId);
        const stock =
          !variant || variant.isActive === false ? 0 : Math.max(0, variant.stock ?? 0);
        updates.push({
          productId: product.id,
          variantId: line.variantId,
          stock,
        });
      } else {
        updates.push({
          productId: product.id,
          variantId: null,
          stock: Math.max(0, product.stock ?? 0),
        });
      }
    }
  }

  if (updates.length) {
    useCartStore.getState().syncLiveStock(updates);
  }

  // Auto-remove fully out-of-stock lines after live sync.
  const after = useCartStore.getState().items;
  const toRemove = after.filter((i) => i.stock <= 0);
  if (!toRemove.length) return { removed: [] };

  const removed = toRemove.map((i) => ({
    name: i.name,
    key: itemLineKey(i),
  }));

  useCartStore.setState((state) => ({
    items: state.items.filter((i) => i.stock > 0),
  }));

  useCartUiStore.getState().setStockRemovalNotice(buildRemovalNotice(removed));

  return { removed };
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
