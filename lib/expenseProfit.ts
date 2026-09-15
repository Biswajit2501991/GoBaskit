import { roundMoney } from '@/lib/shopSourcing';

export type ProfitTone = 'loss' | 'warn' | 'good' | 'neutral';

export function netAfterExpenses(orderProfit: number, expenses: number) {
  const gross = roundMoney(Number(orderProfit) || 0);
  const spent = roundMoney(Math.max(0, Number(expenses) || 0));
  const net = roundMoney(gross - spent);
  return { gross, spent, net };
}

/**
 * Remaining profit as a share of order profit:
 * loss (red) if net < 0; yellow if still profit but ≤ 50%; green if > 50%.
 */
export function profitTone(orderProfit: number, expenses: number): ProfitTone {
  const { gross, net } = netAfterExpenses(orderProfit, expenses);
  if (net < 0) return 'loss';
  if (gross <= 0 && net === 0) return 'neutral';
  if (gross <= 0) return net > 0 ? 'good' : 'neutral';
  const remainingShare = net / gross;
  if (remainingShare > 0.5) return 'good';
  return 'warn';
}

export const EXPENSE_CATEGORIES = [
  'fuel',
  'packaging',
  'rent',
  'salary',
  'utilities',
  'misc',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function normalizeExpenseCategory(raw: unknown): ExpenseCategory {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value)
    ? (value as ExpenseCategory)
    : 'other';
}
