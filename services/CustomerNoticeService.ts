import { prisma } from '@/lib/prisma';
import { normalizeMobile } from '@/utils/mobile';

export class CustomerNoticeService {
  static async create(params: {
    mobile: string;
    message: string;
    expiresAt: Date;
    orderId?: string;
  }) {
    return prisma.customerNotice.create({
      data: {
        mobile: normalizeMobile(params.mobile),
        message: params.message,
        expiresAt: params.expiresAt,
        orderId: params.orderId,
      },
    });
  }

  static async listActiveForMobile(mobile: string) {
    const now = new Date();
    return prisma.customerNotice.findMany({
      where: {
        mobile: normalizeMobile(mobile),
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  static async purgeExpired() {
    const result = await prisma.customerNotice.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }
}
