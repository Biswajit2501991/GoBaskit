'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/utils/formatter';
import type { ProfitTone } from '@/lib/expenseProfit';

const TONE_CLASS: Record<ProfitTone, string> = {
  loss: 'text-red-700 bg-red-50 border-red-200',
  warn: 'text-amber-800 bg-amber-50 border-amber-200',
  good: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  neutral: 'text-gray-600 bg-gray-50 border-gray-200',
};

export default function AdminProfitChip() {
  const [label, setLabel] = useState<string | null>(null);
  const [tone, setTone] = useState<ProfitTone>('neutral');
  const [title, setTitle] = useState('Today’s profit after expenses');

  useEffect(() => {
    let live = true;
    fetch('/api/admin/expenses/summary', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!live || !json?.show) return;
        setTone(json.tone as ProfitTone);
        setLabel(formatCurrency(Number(json.netProfit) || 0));
        setTitle(
          `Today after expenses. Order profit ${formatCurrency(Number(json.orderProfit) || 0)} − expenses ${formatCurrency(Number(json.expensesTotal) || 0)}.`,
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!label) return null;

  return (
    <div
      className={`shrink-0 rounded-xl border px-3 py-1.5 ${TONE_CLASS[tone]}`}
      title={title}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide leading-none">Total profit</p>
      <p className="text-sm font-bold leading-tight mt-0.5">{label}</p>
    </div>
  );
}
