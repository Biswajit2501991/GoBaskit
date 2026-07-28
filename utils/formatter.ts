export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    // Display at most one decimal (₹52.98 → ₹53); whole rupees stay without ".0".
    maximumFractionDigits: 1,
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
