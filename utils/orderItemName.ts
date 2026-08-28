/**
 * Full line name for an ordered item. Never shorten to the first word —
 * "Amul Taaza 1L" and "Amul Gold 1L" must stay distinct.
 */
export function composeOrderItemName(params: {
  productName?: string | null;
  variantLabel?: string | null;
  clientName?: string | null;
}): string {
  const product = (params.productName ?? '').trim();
  const variant = (params.variantLabel ?? '').trim();
  const client = (params.clientName ?? '').trim();

  let catalog = product;
  if (variant) {
    const productLc = product.toLowerCase();
    const variantLc = variant.toLowerCase();
    if (!product) {
      catalog = variant;
    } else if (productLc.includes(variantLc) || variantLc.includes(productLc)) {
      catalog = product.length >= variant.length ? product : variant;
    } else {
      catalog = `${product} — ${variant}`;
    }
  }

  if (!catalog) return client || 'Item';
  if (!client) return catalog;
  return client.length > catalog.length ? client : catalog;
}

/** Cart line for WhatsApp / UI: product name plus option label when present. */
export function formatCartLineName(item: {
  name: string;
  variantLabel?: string | null;
}): string {
  return composeOrderItemName({
    productName: item.name,
    variantLabel: item.variantLabel,
    clientName: item.name,
  });
}

export function formatOrderItemsSummary(
  items: Array<{ name: string; quantity: number }>,
): string {
  return items
    .map((item) => `${item.name} × ${item.quantity}`)
    .filter((line) => line.trim().length > 0)
    .join('\n');
}
