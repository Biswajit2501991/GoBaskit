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
  items: Array<{ name?: string; productName?: string; quantity: number; unit?: string | null }>,
): string {
  return items
    .map((item) =>
      formatOrderLineLabel({
        productName: item.productName ?? item.name ?? 'Item',
        quantity: item.quantity,
        unit: item.unit,
      }),
    )
    .filter((line) => line.trim().length > 0)
    .join('\n');
}

/** Append pack size when it is not already in the name (e.g. Maaza + 600 ml). */
export function appendPackSize(name: string, unit?: string | null): string {
  const n = name.trim();
  const u = (unit ?? '').trim();
  if (!n) return u || 'Item';
  if (!u) return n;
  const nameCompact = n.toLowerCase().replace(/\s+/g, '');
  const unitCompact = u.toLowerCase().replace(/\s+/g, '');
  if (unitCompact && nameCompact.includes(unitCompact)) return n;
  return `${n} (${u})`;
}

/** Staff / track line: "Maaza × 1 · 600 ml" without duplicating size already in the name. */
export function formatOrderLineLabel(item: {
  productName: string;
  quantity: number;
  unit?: string | null;
}): string {
  const name = (item.productName ?? '').trim() || 'Item';
  const unit = (item.unit ?? '').trim();
  const nameCompact = name.toLowerCase().replace(/\s+/g, '');
  const unitCompact = unit.toLowerCase().replace(/\s+/g, '');
  const sizePart = unit && unitCompact && !nameCompact.includes(unitCompact) ? ` · ${unit}` : '';
  return `${name} × ${item.quantity}${sizePart}`;
}
