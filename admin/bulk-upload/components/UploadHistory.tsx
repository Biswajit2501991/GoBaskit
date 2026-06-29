'use client';

import { useMemo, useState } from 'react';
import type { ImportBatchRecord } from '@/types/BulkUpload';
import { canUndoBatch } from '../utils/undo';
import { Button } from '@/components/ui/button';
import { History, RotateCcw } from 'lucide-react';

interface Props {
  history: ImportBatchRecord[];
  onUndo: (batchId: string) => Promise<void>;
  onRefresh: () => void;
}

export function UploadHistory({ history, onUndo, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [undoing, setUndoing] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return history.filter(
      (h) => !q || h.filename.toLowerCase().includes(q) || h.adminEmail.toLowerCase().includes(q)
    );
  }, [history, search]);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          Upload History
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>Refresh</Button>
      </div>
      <input
        type="search"
        placeholder="Search uploaded files..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm mb-3 h-9 rounded-lg border border-gray-200 px-3 text-sm"
        aria-label="Search upload history"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No import history yet.</p>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Imported By</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Results</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">{h.filename}</td>
                  <td className="px-3 py-2 text-gray-600">{h.adminEmail}</td>
                  <td className="px-3 py-2 text-gray-600">{new Date(h.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs">
                    +{h.imported} / ↑{h.updated} / ⊘{h.skipped} / ✕{h.failed}
                  </td>
                  <td className="px-3 py-2">
                    {canUndoBatch(h) && (
                      <button
                        type="button"
                        disabled={undoing === h.id}
                        onClick={async () => {
                          setUndoing(h.id);
                          try { await onUndo(h.id); } finally { setUndoing(null); }
                        }}
                        className="text-xs text-blinkit-green hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Undo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
