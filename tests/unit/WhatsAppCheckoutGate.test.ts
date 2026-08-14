const prismaMock = {
  customerMobile: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  customer: {
    updateMany: jest.fn(),
  },
  whatsAppVerification: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';

describe('WhatsApp checkout verification gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.customerMobile.findFirst.mockResolvedValue({ isWhatsappVerified: false });
    prismaMock.whatsAppVerification.findMany.mockResolvedValue([]);
    prismaMock.customerMobile.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.customer.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it('does not unlock checkout merely because the customer acknowledged sending WhatsApp', async () => {
    prismaMock.whatsAppVerification.findFirst.mockResolvedValue({ id: 'pending-1' });

    const state = await WhatsAppVerificationService.getCheckoutVerificationState(
      '+919876543210',
    );

    expect(state).toEqual({
      needsVerification: true,
      isVerified: false,
      canCheckout: false,
      messageSent: true,
    });
  });

  it('allows repeat checkout when the backend verified flag is present', async () => {
    prismaMock.customerMobile.findFirst.mockResolvedValue({ isWhatsappVerified: true });

    const state = await WhatsAppVerificationService.getCheckoutVerificationState(
      '+919876543210',
    );

    expect(state).toEqual({
      needsVerification: false,
      isVerified: true,
      canCheckout: true,
      messageSent: false,
    });
    expect(prismaMock.whatsAppVerification.findFirst).not.toHaveBeenCalled();
  });
});
