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
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it('rejects when there is no pending or expired request', async () => {
    prismaMock.whatsAppVerification.findFirst.mockResolvedValue(null);

    await expect(
      WhatsAppVerificationService.logSentAck({ mobileE164: '+919876543210' }),
    ).rejects.toThrow(/Generate a code/);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns immediately when the number is already verified', async () => {
    prismaMock.whatsAppVerification.findFirst.mockResolvedValue({
      id: 'v1',
      status: 'VERIFIED',
      customerMobileId: 'cm1',
      mobile: '+919876543210',
    });

    const result = await WhatsAppVerificationService.logSentAck({
      mobileE164: '+919876543210',
      verificationId: 'v1',
    });

    expect(result).toEqual({
      mobile: '+919876543210',
      verified: true,
      needsVerification: false,
      canCheckout: true,
      messageSent: true,
      verification: null,
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('verifies when WhatsApp is opened, same as sent-ack', async () => {
    prismaMock.whatsAppVerification.findFirst.mockResolvedValue({
      id: 'v-open',
      mobile: '+919876543210',
      status: 'PENDING',
      customerMobileId: 'cm1',
    });

    const result = await WhatsAppVerificationService.logWhatsAppOpened({
      mobileE164: '+919876543210',
      verificationId: 'v-open',
    });

    expect(result.verified).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('verifies an expired code in one transaction without a status re-read', async () => {
    prismaMock.whatsAppVerification.findFirst.mockResolvedValue({
      id: 'v-expired',
      mobile: '+919876543210',
      status: 'EXPIRED',
      customerMobileId: 'cm1',
    });

    const result = await WhatsAppVerificationService.logSentAck({
      mobileE164: '+919876543210',
      verificationId: 'v-expired',
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const ops = prismaMock.$transaction.mock.calls[0][0] as unknown[];
    expect(ops).toHaveLength(5);
    expect(result.verified).toBe(true);
    expect(result.canCheckout).toBe(true);
    expect(result.needsVerification).toBe(false);
  });
});
