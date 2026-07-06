import { formatCurrency } from './formatter';

/** Selling price is always stored in `price`. */
export function getSellingPrice(price: number): number {
  return price;
}

/** MRP / list price when actual price is set and higher than selling price. */
export function getListPrice(
  actualPrice: number | null | undefined,
  sellingPrice: number
): number | null {
  if (actualPrice == null || actualPrice <= sellingPrice) return null;
  return actualPrice;
}

export function calculateDiscountPercent(
  actualPrice: number | null | undefined,
  sellingPrice: number
): number {
  const list = getListPrice(actualPrice, sellingPrice);
  if (!list) return 0;
  return Math.round(((list - sellingPrice) / list) * 10000) / 100;
}

export function buildProductPricingData(input: {
  price: number;
  actualPrice?: number | null;
}) {
  const price = input.price;
  const actualPrice = getListPrice(input.actualPrice ?? null, price);
  const discount = calculateDiscountPercent(actualPrice, price);
  return { price, actualPrice, discount };
}

/** @deprecated Price is already the selling price. */
export function getEffectivePrice(price: number, _discount?: number): number {
  return price;
}

export function hasProductDiscount(
  actualPrice: number | null | undefined,
  sellingPrice: number,
  discount?: number
): boolean {
  if (discount != null && discount > 0) return true;
  return getListPrice(actualPrice, sellingPrice) !== null;
}

export function formatProductPriceLabel(
  actualPrice: number | null | undefined,
  sellingPrice: number
): { selling: string; list: string | null } {
  const list = getListPrice(actualPrice, sellingPrice);
  return {
    selling: formatCurrency(sellingPrice),
    list: list ? formatCurrency(list) : null,
  };
}
