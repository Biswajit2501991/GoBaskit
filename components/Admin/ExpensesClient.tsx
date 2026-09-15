'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDateTime } from '@/utils/formatter';
import { EXPENSE_CATEGORIES, type ProfitTone } from '@/lib/expenseProfit';
import { istYmd } from '@/lib/istDay';

type ExpenseItem = {
  id: string;
  amount: number;
  category: string;
  note: string;
  incurredAt: string;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
};

type ListPayload = {
  expensesEnabled: boolean;
  showTotalProfitEnabled: boolean;
  expensesTotal: number;
  orderProfit: number | null;
  netProfit: number | null;
  tone: ProfitTone | null;
  items: ExpenseItem[];
};

const TONE_CLASS: Record<ProfitTone, string> = {
  loss: 'text-red-700 bg-red-50 border-red-100',
  warn: 'text-amber-700 bg-amber-50 border-amber-100',
  good: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  neutral: 'text-gray-600 bg-gray-50 border-gray-100',
};

function Switch({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-7 w-12 rounded-full transition-colors ${
        on ? 'bg-blinkit-green' : 'bg-gray-300'
      } disabled:opacity-60`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

export default function ExpensesClient({
  canEdit,
  canToggle,
}: {
  canEdit: boolean;
  canToggle: boolean;
}) {
  const router = useRouter();
  const today = istYmd();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [q, setQ] = useState('');
  const [data, setData] = useState<ListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [note, setNote] = useState('');
  const [incurredAt, setIncurredAt] = useState(today);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ from, to });
    if (q.trim()) qs.set('q', q.trim());
    const res = await fetch(`/api/admin/expenses?${qs}`, { cache: 'no-store' });
    const json = res.ok ? ((await res.json()) as ListPayload) : null;
    setData(json);
    setLoading(false);
  }, [from, to, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(patch: { expensesEnabled?: boolean; showTotalProfitEnabled?: boolean }) {
    if (!canToggle) return;
    setToggling(true);
    const res = await fetch('/api/admin/expenses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setToggling(false);
    if (!res.ok) {
      alert('Only staff who can edit Settings can turn these switches on or off.');
      return;
    }
    await load();
    router.refresh();
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !data?.expensesEnabled) return;
    setSaving(true);
    const res = await fetch('/api/admin/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(amount),
        category,
        note,
        incurredAt,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      alert(json?.error || 'Could not add expense.');
      return;
    }
    setAmount('');
    setNote('');
    await load();
    router.refresh();
  }

  async function removeExpense(id: string) {
    if (!canEdit || !data?.expensesEnabled) return;
    if (!confirm('Remove this expense? The row is kept in the database.')) return;
    const res = await fetch(`/api/admin/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      alert(json?.error || 'Could not remove expense.');
      return;
    }
    await load();
    router.refresh();
  }

  const expensesOn = data?.expensesEnabled !== false;
  const profitOn = data?.showTotalProfitEnabled === true;

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-gray-500 mt-1">
            Staff operating costs. Order profit is unchanged unless Show Total Profit is on.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-3 text-sm font-medium">
            <span>Add Expense</span>
            <Switch
              on={expensesOn}
              disabled={!canToggle || toggling}
              onClick={() => void toggle({ expensesEnabled: !expensesOn })}
            />
            <span className="text-gray-500 font-normal">{expensesOn ? 'On' : 'Off'}</span>
          </label>
          <label className="flex items-center gap-3 text-sm font-medium">
            <span>Show Total Profit</span>
            <Switch
              on={profitOn}
              disabled={!canToggle || toggling}
              onClick={() => void toggle({ showTotalProfitEnabled: !profitOn })}
            />
            <span className="text-gray-500 font-normal">{profitOn ? 'On' : 'Off'}</span>
          </label>
        </div>
      </div>

      {canEdit && expensesOn ? (
        <form onSubmit={(e) => void addExpense(e)} className="bg-white rounded-xl border p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="text-sm">
            Amount (₹)
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Date
            <input
              type="date"
              value={incurredAt}
              onChange={(e) => setIncurredAt(e.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
            />
          </label>
          <label className="text-sm lg:col-span-1 sm:col-span-2">
            Note
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="What was this for?"
              className="mt-1 block h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-blinkit-green text-white text-sm font-semibold px-4 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Add expense'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-4">
          {expensesOn
            ? 'You can view expenses. Ask a Super Admin for finance edit access to add them.'
            : 'Add Expense is off. Existing rows are kept. Ask a Super Admin to turn the switch on.'}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block h-10 rounded-lg border border-gray-200 px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block h-10 rounded-lg border border-gray-200 px-3 text-sm"
          />
        </label>
        <label className="text-sm flex-1 min-w-[12rem]">
          Search
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Note, category, staff…"
            className="mt-1 block h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
          />
        </label>
        {profitOn && data?.netProfit != null && data.tone ? (
          <div className={`rounded-xl border px-4 py-2 min-w-[10rem] ${TONE_CLASS[data.tone]}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide">Total profit</p>
            <p className="text-lg font-bold">{formatCurrency(data.netProfit)}</p>
            <p className="text-[11px] opacity-80">After expenses {formatCurrency(data.expensesTotal)}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-2 min-w-[10rem]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Expenses</p>
            <p className="text-lg font-bold">{formatCurrency(data?.expensesTotal ?? 0)}</p>
          </div>
        )}
      </div>

      {loading || !data ? (
        <p className="text-sm text-gray-400">Loading expenses…</p>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Note</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Added by</th>
                {canEdit && expensesOn ? <th className="p-3" /> : null}
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No expenses in this date range.
                  </td>
                </tr>
              ) : (
                data.items.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50">
                    <td className="p-3 whitespace-nowrap">{formatDateTime(row.incurredAt)}</td>
                    <td className="p-3 capitalize">{row.category}</td>
                    <td className="p-3">{row.note || '—'}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                    <td className="p-3 text-gray-500">{row.createdBy?.name ?? '—'}</td>
                    {canEdit && expensesOn ? (
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          className="text-xs text-red-600"
                          onClick={() => void removeExpense(row.id)}
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
