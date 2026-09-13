'use client';

import { formatCurrency, formatDateTime } from '@/utils/formatter';

export type PriceHistoryFields = {
  previousPrice?: number | null;
  earlierPrice?: number | null;
  previousPriceAt?: string | Date | null;
};

function deltaLabel(from: number, to: number): string {
  const diff = Math.round((to - from) * 100) / 100;
  if (diff === 0) return '';
  const sign = diff > 0 ? '+' : '−';
  return `${sign}${formatCurrency(Math.abs(diff))}`;
}

export default function SellingPriceHistoryNote({
  currentPrice,
  history,
}: {
  currentPrice: number;
  history?: PriceHistoryFields | null;
}) {
  if (!history?.previousPrice && !history?.earlierPrice) return null;
  const previous = history.previousPrice ?? null;
  const earlier = history.earlierPrice ?? null;
  const changed =
    history.previousPriceAt != null
      ? formatDateTime(
          typeof history.previousPriceAt === 'string'
            ? history.previousPriceAt
            : history.previousPriceAt.toISOString(),
        )
      : null;
  const lastChange = previous != null ? deltaLabel(previous, currentPrice) : '';

  return (
    <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-2 text-[11px] text-gray-600 space-y-0.5">
      <p className="font-semibold text-gray-700">Last selling prices</p>
      <p>
        {earlier != null ? `${formatCurrency(earlier)} → ` : ''}
        {previous != null ? `${formatCurrency(previous)} → ` : ''}
        <span className="font-semibold text-gray-900">{formatCurrency(currentPrice)}</span>
        {lastChange ? (
          <span className={previous != null && currentPrice >= previous ? ' text-amber-800' : ' text-emerald-800'}>
            {' '}
            ({lastChange})
          </span>
        ) : null}
      </p>
      {changed ? <p className="text-gray-400">Last change {changed}</p> : null}
    </div>
  );
}
