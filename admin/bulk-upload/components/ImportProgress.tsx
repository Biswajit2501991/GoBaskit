'use client';

interface Props {
  percent: number;
  processed: number;
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  speed: number;
  etaSeconds: number;
}

export function ImportProgress({
  percent,
  processed,
  total,
  imported,
  updated,
  skipped,
  failed,
  speed,
  etaSeconds,
}: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-4" role="status" aria-live="polite">
      <p className="text-sm font-semibold mb-3">Uploading...</p>
      <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-2">
        <div
          className="h-full bg-blinkit-green transition-all duration-300 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-sm font-medium text-blinkit-green mb-3">{percent}%</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-600">
        <div><span className="font-semibold text-gray-900">{processed}</span> / {total} rows processed</div>
        <div><span className="font-semibold text-gray-900">{total - processed}</span> remaining</div>
        <div>~{etaSeconds}s estimated</div>
        <div>{speed} rows/sec</div>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 text-xs">
        <span className="text-green-700">{imported} imported</span>
        <span className="text-blue-700">{updated} updated</span>
        <span className="text-amber-700">{skipped} skipped</span>
        <span className="text-red-700">{failed} failed</span>
      </div>
    </div>
  );
}
