import { prisma } from '@/lib/prisma';
import { expenseSchema, formatZodFlattenError } from '@/lib/validations';
import { istRangeFromTo, istYmd } from '@/lib/istDay';
import { netAfterExpenses, normalizeExpenseCategory, profitTone } from '@/lib/expenseProfit';
import { roundMoney } from '@/lib/shopSourcing';
import { SettingsService } from '@/services/SettingsService';
import { ProfitDashboardService } from '@/services/ProfitDashboardService';

export class ExpenseService {
  static async flags() {
    const config = await SettingsService.getStoreConfig();
    return {
      expensesEnabled: config.expensesEnabled !== false,
      showTotalProfitEnabled: config.showTotalProfitEnabled === true,
    };
  }

  static async setFlags(partial: { expensesEnabled?: boolean; showTotalProfitEnabled?: boolean }) {
    return SettingsService.updateStoreConfig(partial);
  }

  static async list(params: { from: string; to: string; q?: string }) {
    const range = istRangeFromTo(params.from, params.to);
    if (!range) throw new Error('Invalid date range');
    const q = params.q?.trim().toLowerCase() ?? '';
    const flags = await this.flags();
    const rows = await prisma.expense.findMany({
      where: {
        deletedAt: null,
        incurredAt: { gte: range.from, lte: range.to },
      },
      orderBy: [{ incurredAt: 'desc' }, { createdAt: 'desc' }],
      include: { createdBy: { select: { id: true, name: true } } },
    });
    const filtered = q
      ? rows.filter((row) => {
          const hay = `${row.note} ${row.category} ${row.createdBy?.name ?? ''}`.toLowerCase();
          return hay.includes(q);
        })
      : rows;
    const expensesTotal = roundMoney(filtered.reduce((sum, row) => sum + Number(row.amount), 0));
    const orderProfit = flags.showTotalProfitEnabled
      ? await ProfitDashboardService.orderProfitTotal({
          from: range.from,
          to: range.to,
          includeDelivery: true,
        })
      : 0;
    const net = flags.showTotalProfitEnabled
      ? netAfterExpenses(orderProfit, expensesTotal)
      : { gross: 0, spent: expensesTotal, net: 0 };

    return {
      ...flags,
      from: params.from,
      to: params.to,
      expensesTotal,
      orderProfit: flags.showTotalProfitEnabled ? net.gross : null,
      netProfit: flags.showTotalProfitEnabled ? net.net : null,
      tone: flags.showTotalProfitEnabled ? profitTone(orderProfit, expensesTotal) : null,
      items: filtered.map(serializeExpense),
    };
  }

  static async todayChip() {
    const flags = await this.flags();
    if (!flags.showTotalProfitEnabled) {
      return { show: false as const };
    }
    const ymd = istYmd();
    const range = istRangeFromTo(ymd, ymd)!;
    const [orderProfit, spentAgg] = await Promise.all([
      ProfitDashboardService.orderProfitTotal({
        from: range.from,
        to: range.to,
        includeDelivery: true,
      }),
      prisma.expense.aggregate({
        where: { deletedAt: null, incurredAt: { gte: range.from, lte: range.to } },
        _sum: { amount: true },
      }),
    ]);
    const expensesTotal = roundMoney(Number(spentAgg._sum.amount) || 0);
    const { net } = netAfterExpenses(orderProfit, expensesTotal);
    return {
      show: true as const,
      ymd,
      orderProfit,
      expensesTotal,
      netProfit: net,
      tone: profitTone(orderProfit, expensesTotal),
    };
  }

  static parseBody(body: unknown) {
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
      return { error: formatZodFlattenError(parsed.error.flatten()) };
    }
    const day = istRangeFromTo(parsed.data.incurredAt, parsed.data.incurredAt);
    if (!day) return { error: 'Invalid date' };
    return {
      data: {
        amount: roundMoney(parsed.data.amount),
        category: normalizeExpenseCategory(parsed.data.category),
        note: parsed.data.note?.trim() ?? '',
        incurredAt: day.from,
      },
    };
  }

  static async create(body: unknown, staffId: string | undefined) {
    const flags = await this.flags();
    if (!flags.expensesEnabled) throw new Error('Add Expense is turned off');
    const parsed = this.parseBody(body);
    if ('error' in parsed) throw new Error(parsed.error);
    const row = await prisma.expense.create({
      data: {
        ...parsed.data,
        createdById: staffId ?? null,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    return serializeExpense(row);
  }

  static async update(id: string, body: unknown) {
    const flags = await this.flags();
    if (!flags.expensesEnabled) throw new Error('Add Expense is turned off');
    const existing = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    const parsed = this.parseBody(body);
    if ('error' in parsed) throw new Error(parsed.error);
    const row = await prisma.expense.update({
      where: { id },
      data: parsed.data,
      include: { createdBy: { select: { id: true, name: true } } },
    });
    return serializeExpense(row);
  }

  static async softDelete(id: string) {
    const flags = await this.flags();
    if (!flags.expensesEnabled) throw new Error('Add Expense is turned off');
    const existing = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return null;
    await prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return true;
  }
}

function serializeExpense(row: {
  id: string;
  amount: number;
  category: string;
  note: string;
  incurredAt: Date;
  createdAt: Date;
  createdBy: { id: string; name: string } | null;
}) {
  return {
    id: row.id,
    amount: Number(row.amount),
    category: row.category,
    note: row.note,
    incurredAt: row.incurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  };
}
