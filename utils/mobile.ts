/** Normalize Indian mobile to 10 digits (strips +91 / spaces). */
export function normalizeMobile(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  // 10-digit national already, or longer E.164 without leading 91 handled above
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(-10);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function isValidIndianMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(mobile);
}
