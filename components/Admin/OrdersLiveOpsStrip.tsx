'use client';

import { ACTIVE_ORDER_STATUSES } from '@/constants/orders';

export type OpsSummary = {
  unassigned: {
    total: number;
    byStatus: Record<string, number>;
  };
  staff: Array<{
    id: string;
    name: string;
    total: number;
    byStatus: Record<string, number>;
  }>;
};

export type OpsFilter =
  | null
  | { type: 'unassigned'; status?: string }
  | { type: 'staff'; staffId: string };

const STATUS_SHORT: Record<string, string> = {
  PENDING: 'Pend',
  ACCEPTED: 'Acc',
  PACKED: 'Pack',
  OUT_FOR_DELIVERY: 'OFD',
};

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

function breakdownText(byStatus: Record<string, number>) {
  return ACTIVE_ORDER_STATUSES.filter((s) => (byStatus[s] ?? 0) > 0)
    .map((s) => `${STATUS_SHORT[s] ?? s} ${byStatus[s]}`)
    .join(' · ');
}

type OrdersLiveOpsStripProps = {
  summary: OpsSummary | null;
  loading?: boolean;
  filter: OpsFilter;
  onFilterChange: (filter: OpsFilter) => void;
};

export default function OrdersLiveOpsStrip({
  summary,
  loading = false,
  filter,
  onFilterChange,
}: OrdersLiveOpsStripProps) {
  const unassignedActive =
    filter?.type === 'unassigned' && !filter.status;
  const staffActiveId = filter?.type === 'staff' ? filter.staffId : null;

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-gray-800">
          Live ops
          {loading && (
            <span className="ml-2 font-semibold normal-case tracking-normal text-gray-400 animate-pulse">
              updating…
            </span>
          )}
        </p>
        {filter && (
          <button
            type="button"
            onClick={() => onFilterChange(null)}
            className="text-xs font-semibold text-blinkit-green hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="p-3 space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
            Unassigned (active)
          </p>
          {!summary ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onFilterChange(
                    unassignedActive ? null : { type: 'unassigned' },
                  )
                }
                className={`rounded-lg px-2.5 py-1.5 text-sm font-extrabold border transition-colors ${
                  unassignedActive
                    ? 'bg-amber-100 border-amber-300 text-amber-950'
                    : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                }`}
              >
                Unassigned {summary.unassigned.total}
              </button>
              {ACTIVE_ORDER_STATUSES.map((status) => {
                const count = summary.unassigned.byStatus[status] ?? 0;
                if (count <= 0) return null;
                const active =
                  filter?.type === 'unassigned' && filter.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      onFilterChange(
                        active ? null : { type: 'unassigned', status },
                      )
                    }
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold border transition-colors ${
                      active
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    {statusLabel(status)} {count}
                  </button>
                );
              })}
              {summary.unassigned.total === 0 && (
                <span className="text-sm text-gray-400 px-1 py-1.5">None</span>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
            Staff load (active, not delivered)
          </p>
          {!summary ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : summary.staff.length === 0 ? (
            <p className="text-sm text-gray-400">No assigned active orders</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {summary.staff.map((s) => {
                const active = staffActiveId === s.id;
                const detail = breakdownText(s.byStatus);
                const overloaded = s.total >= 5;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      onFilterChange(active ? null : { type: 'staff', staffId: s.id })
                    }
                    title={detail}
                    className={`rounded-lg px-2.5 py-1.5 text-left border transition-colors max-w-full ${
                      active
                        ? 'bg-blinkit-green border-blinkit-green text-white'
                        : overloaded
                          ? 'bg-orange-50 border-orange-200 text-orange-950 hover:bg-orange-100'
                          : 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-sm font-extrabold">
                      {s.name} {s.total}
                    </span>
                    {detail ? (
                      <span
                        className={`block text-[11px] font-semibold mt-0.5 ${
                          active ? 'text-white/90' : 'text-gray-600'
                        }`}
                      >
                        {detail}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
