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

const pendingRow = {
  id: 'v-open',
  mobile: '+919876543210',
  status: 'PENDING' as const,
  customerMobileId: 'cm1',
  verificationCode: 'GB-123456',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 60_000),
  verifiedAt: null,
  sentAcknowledgedAt: null,
};

describe('customer sent-ack does not auto-verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockResolvedValue([]);
    prismaMock.customerMobile.findFirst.mockResolvedValue({ isWhatsappVerified: false });
    prismaMock.whatsAppVerification.findMany.mockResolvedValue([]);
    prismaMock.whatsAppVerification.update.mockResolvedValue(pendingRow);
    prismaMock.whatsAppVerification.findUnique.mockResolvedValue(pendingRow);
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

    expect(result.verified).toBe(true);
    expect(prismaMock.whatsAppVerification.update).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('does not verify when WhatsApp is opened', async () => {
    prismaMock.whatsAppVerification.findFirst.mockResolvedValue(pendingRow);

    const result = await WhatsAppVerificationService.logWhatsAppOpened({
      mobileE164: '+919876543210',
      verificationId: 'v-open',
    });

    expect(result.verified).toBe(false);
    expect(result.canCheckout).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.whatsAppVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v-open' },
        data: { sentAcknowledgedAt: expect.any(Date) },
      }),
    );
  });

  it('does not verify an expired or pending code on sent-ack', async () => {
    prismaMock.whatsAppVerification.findFirst.mockResolvedValue({
      ...pendingRow,
      id: 'v-expired',
      status: 'EXPIRED',
    });
    prismaMock.whatsAppVerification.findUnique.mockResolvedValue({
      ...pendingRow,
      id: 'v-expired',
      status: 'EXPIRED',
    });

    const result = await WhatsAppVerificationService.logSentAck({
      mobileE164: '+919876543210',
      verificationId: 'v-expired',
    });

    expect(result.verified).toBe(false);
    expect(prismaMock.whatsAppVerification.update).not.toHaveBeenCalled();
    const verifiedWrites = prismaMock.customerMobile.updateMany.mock.calls.filter(
      (call) => call[0]?.data?.isWhatsappVerified === true,
    );
    expect(verifiedWrites).toHaveLength(0);
  });

  it('does not auto-approve when the inbound WhatsApp sender is a different number', async () => {
    prismaMock.whatsAppVerification.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'v-pending',
        mobile: '+919876543210',
        status: 'PENDING',
      });

    const result = await WhatsAppVerificationService.tryAutoApproveFromInbound({
      senderFrom: '919999999999',
      messageBody: 'Please verify GB-123456',
    });

    expect(result).toBe('sender_mismatch');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('leaves an already-verified number unchanged when the same sender writes again', async () => {
    prismaMock.whatsAppVerification.findFirst.mockResolvedValue({
      ...pendingRow,
      status: 'VERIFIED',
    });

    const result = await WhatsAppVerificationService.tryAutoApproveFromInbound({
      senderFrom: '919876543210',
      messageBody: 'GB-123456',
    });

    expect(result).toBe('already_verified');
    expect(prismaMock.whatsAppVerification.update).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
