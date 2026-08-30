const prismaMock = {
  customerMobile: {
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  customer: {
    updateMany: jest.fn(),
  },
  whatsAppVerification: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

jest.mock('@/services/VerificationAuditService', () => ({
  VerificationAuditService: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/lib/realtime/eventBus', () => ({
  adminEventBus: { emit: jest.fn() },
}));

import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';

describe('customer sent-ack auto-verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.customerMobile.findFirst.mockResolvedValue({ isWhatsappVerified: false });
    prismaMock.whatsAppVerification.findMany.mockResolvedValue([]);
    prismaMock.customerMobile.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.customer.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it('rejects when there is no pending or expired request', async () => {
    prismaMock.whatsAppVerification.findFirst.mockResolvedValue(null);

    await expect(
      WhatsAppVerificationService.logSentAck({ mobileE164: '+919876543210' }),
    ).rejects.toThrow(/Generate a code/);
  });

  it('revives an expired code and verifies the number without WhatsApp API', async () => {
    const expired = {
      id: 'v-expired',
      mobile: '+919876543210',
      status: 'EXPIRED',
      customerMobileId: 'cm1',
      expiresAt: new Date(Date.now() - 60_000),
      customerMobile: { id: 'cm1' },
    };
    prismaMock.customerMobile.findFirst
      .mockResolvedValueOnce({ isWhatsappVerified: false })
      .mockResolvedValue({ isWhatsappVerified: true });
    prismaMock.whatsAppVerification.findFirst
      .mockResolvedValueOnce(expired)
      .mockResolvedValue(null);
    prismaMock.whatsAppVerification.update.mockResolvedValue({ ...expired, status: 'PENDING' });
    prismaMock.whatsAppVerification.findUnique.mockResolvedValue({
      ...expired,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 10 * 60_000),
      customerMobile: { id: 'cm1' },
    });

    const result = await WhatsAppVerificationService.logSentAck({
      mobileE164: '+919876543210',
      verificationId: 'v-expired',
    });

    expect(prismaMock.whatsAppVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v-expired' },
        data: expect.objectContaining({
          status: 'PENDING',
          sentAcknowledgedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.verified).toBe(true);
    expect(result.canCheckout).toBe(true);
  });
});
