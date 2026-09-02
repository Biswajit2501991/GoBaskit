import { prisma } from '@/lib/prisma';
import { DashboardService } from '@/services/DashboardService';
import { normalizeMobile } from '@/utils/mobile';
import {
  countFeedbackWords,
  normalizeFeedbackNote,
  ORDER_FEEDBACK_MAX_WORDS,
} from '@/lib/orderFeedback';

function customerMobileWhere(mobile: string) {
  const normalized = normalizeMobile(mobile);
  return {
    OR: [{ mobile: normalized }, { mobile: `91${normalized}` }, { mobile: `+91${normalized}` }],
  };
}

export class OrderFeedbackService {
  static async pendingForMobile(mobile: string) {
    const lastDelivered = await prisma.order.findFirst({
      where: {
        status: 'DELIVERED',
        customer: customerMobileWhere(mobile),
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, orderNumber: true },
    });
    if (!lastDelivered) return null;

    const existing = await prisma.orderFeedback.findUnique({
      where: { orderId: lastDelivered.id },
      select: { id: true },
    });
    if (existing) return null;

    return { orderId: lastDelivered.id, orderNumber: lastDelivered.orderNumber };
  }

  static async submit(params: {
    mobile: string;
    orderId: string;
    stars: number;
    note?: string;
  }) {
    const stars = Math.round(params.stars);
    if (stars < 1 || stars > 5) throw new Error('Choose a rating from 1 to 5 stars');

    const note = normalizeFeedbackNote(params.note);
    if (note && countFeedbackWords(note) > ORDER_FEEDBACK_MAX_WORDS) {
      throw new Error(`Note must be ${ORDER_FEEDBACK_MAX_WORDS} words or fewer`);
    }

    await this.assertOwnedDeliveredOrder(params.mobile, params.orderId);

    try {
      await prisma.orderFeedback.create({
        data: {
          orderId: params.orderId,
          customerMobile: normalizeMobile(params.mobile),
          stars,
          skipped: false,
          note,
        },
      });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') throw new Error('Feedback already recorded for this order');
      throw err;
    }

    DashboardService.invalidateCache();
    return { ok: true as const };
  }

  static async skip(params: { mobile: string; orderId: string }) {
    await this.assertOwnedDeliveredOrder(params.mobile, params.orderId);

    try {
      await prisma.orderFeedback.create({
        data: {
          orderId: params.orderId,
          customerMobile: normalizeMobile(params.mobile),
          stars: null,
          skipped: true,
          note: null,
        },
      });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') return { ok: true as const };
      throw err;
    }

    return { ok: true as const };
  }

  static async ratingSummary() {
    const agg = await prisma.orderFeedback.aggregate({
      where: { skipped: false, stars: { not: null } },
      _avg: { stars: true },
      _count: { id: true },
    });
    return {
      averageStars: agg._avg.stars ? Math.round(agg._avg.stars * 10) / 10 : null,
      ratedCount: agg._count.id,
    };
  }

  static async listAdmin(params: { page?: number; pageSize?: number; stars?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
    const where = {
      skipped: false,
      ...(params.stars ? { stars: params.stars } : { stars: { not: null } }),
    };

    const [items, total, summary] = await Promise.all([
      prisma.orderFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          order: { select: { orderNumber: true, id: true } },
        },
      }),
      prisma.orderFeedback.count({ where }),
      this.ratingSummary(),
    ]);

    return {
      ...summary,
      items: items.map((row) => ({
        id: row.id,
        orderId: row.orderId,
        orderNumber: row.order.orderNumber,
        customerMobile: row.customerMobile,
        stars: row.stars,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  private static async assertOwnedDeliveredOrder(mobile: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        status: 'DELIVERED',
        customer: customerMobileWhere(mobile),
      },
      select: { id: true },
    });
    if (!order) throw new Error('Delivered order not found');
  }
}
