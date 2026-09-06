import { Prisma } from '@prisma/client';
import {
  checkoutPlaceOrderUserMessage,
  isRetryableInteractiveTxnError,
} from '@/lib/prismaInteractiveTxn';

describe('checkout interactive transaction errors', () => {
  it('treats Prisma P2028 / expired interactive txns as retryable', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Transaction already closed', {
      code: 'P2028',
      clientVersion: '6.19.3',
    });
    expect(isRetryableInteractiveTxnError(err)).toBe(true);
    expect(
      isRetryableInteractiveTxnError(
        new Error(
          'Transaction already closed: A batch query cannot be executed on an expired transaction. The timeout for this transaction was 8000 ms',
        ),
      ),
    ).toBe(true);
    expect(isRetryableInteractiveTxnError(new Error('Insufficient stock for a product'))).toBe(
      false,
    );
  });

  it('never sends Prisma internals to the customer', () => {
    const raw = new Error(
      'Invalid `prisma.order.update()` invocation:\nTransaction API error: Transaction already closed',
    );
    expect(checkoutPlaceOrderUserMessage(raw)).toBe(
      'Checkout is taking longer than usual. Please try Place Order again.',
    );
    expect(checkoutPlaceOrderUserMessage(new Error('Insufficient stock for a product in your cart'))).toBe(
      'Insufficient stock for a product in your cart',
    );
  });
});
