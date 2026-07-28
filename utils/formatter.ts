export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    // Round to whole rupees for display (₹49.5 → ₹50, ₹48.4 → ₹48). Stored values unchanged.
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function getEffectivePrice(price: number, _discount?: number): number {
  return price;
}
