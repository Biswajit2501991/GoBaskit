import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** Wait to acquire a connection vs time allowed after the transaction starts. */
export const CHECKOUT_TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;

export function isRetryableInteractiveTxnError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2028') {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /P2028|Transaction already closed|expired transaction|interactive transaction timeout/i.test(
    message,
  );
}

export function checkoutPlaceOrderUserMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (/stock/i.test(message) || /unavailable/i.test(message) || /no longer available/i.test(message)) {
    return message;
  }
  if (isRetryableInteractiveTxnError(err)) {
    return 'Checkout is taking longer than usual. Please try Place Order again.';
  }
  return 'Failed to place order. Please try again.';
}

export async function runInteractiveTxn<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { retries?: number; maxWait?: number; timeout?: number } = {},
): Promise<T> {
  const retries = options.retries ?? 1;
  const txOptions = {
    maxWait: options.maxWait ?? CHECKOUT_TX_OPTIONS.maxWait,
    timeout: options.timeout ?? CHECKOUT_TX_OPTIONS.timeout,
  };

  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await prisma.$transaction(fn, txOptions);
    } catch (err) {
      last = err;
      if (attempt < retries && isRetryableInteractiveTxnError(err)) continue;
      throw err;
    }
  }
  throw last;
}
