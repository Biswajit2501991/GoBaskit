'use client';

import { useCartUiStore } from '@/store/cartUiStore';

type StockRemovalNoticeProps = {
  className?: string;
};

/** Dismissible banner when out-of-stock cart lines were auto-removed. */
export default function StockRemovalNotice({ className = '' }: StockRemovalNoticeProps) {
  const notice = useCartUiStore((s) => s.stockRemovalNotice);
  const clear = useCartUiStore((s) => s.clearStockRemovalNotice);

  if (!notice) return null;

  return (
    <div
      role="status"
      className={`rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 flex gap-2 items-start ${className}`}
    >
      <p className="flex-1 min-w-0 leading-snug">{notice}</p>
      <button
        type="button"
        onClick={clear}
        className="shrink-0 text-amber-800/70 hover:text-amber-950 text-xs font-semibold underline-offset-2 hover:underline"
        aria-label="Dismiss notice"
      >
        Dismiss
      </button>
    </div>
  );
}
