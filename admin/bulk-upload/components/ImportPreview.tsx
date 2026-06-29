'use client';

import { useState } from 'react';
import type { ProductTemplateRow, ValidatedRow } from '@/types/BulkUpload';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Pencil } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ready: { label: '✔ Ready', className: 'text-green-700' },
  duplicate: { label: '⚠ Duplicate', className: 'text-amber-700' },
  missing_price: { label: '⚠ Missing Price', className: 'text-amber-700' },
  missing_category: { label: '⚠ Missing Category', className: 'text-amber-700' },
  missing_image: { label: '⚠ Missing Image', className: 'text-amber-700' },
  invalid_category: { label: '⚠ Invalid Category', className: 'text-amber-700' },
  invalid_row: { label: '✕ Invalid', className: 'text-red-700' },
};

interface Props {
  rows: ValidatedRow[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRowUpdate: (rowNumber: number, updates: Partial<ProductTemplateRow>) => Promise<void>;
}

function EditableCell({
  value,
  onSave,
  type = 'text',
  className = '',
}: {
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'number';
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        className={`group flex items-center gap-1 text-left hover:text-blinkit-green ${className}`}
        title="Click to edit"
      >
        <span>{value || '—'}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />
      </button>
    );
  }

  return (
    <Input
      autoFocus
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
      }}
      className="h-8 text-sm"
    />
  );
}

export function ImportPreview({ rows, page, totalPages, onPageChange, onRowUpdate }: Props) {
  const [savingRow, setSavingRow] = useState<number | null>(null);

  async function saveField(row: ValidatedRow, field: keyof ProductTemplateRow, raw: string) {
    setSavingRow(row.row.rowNumber);
    try {
      let updates: Partial<ProductTemplateRow> = {};
      if (field === 'price') {
        const n = parseFloat(raw.replace(/[₹,\s]/g, ''));
        updates = { price: Number.isFinite(n) ? n : null };
      } else if (field === 'productName') {
        updates = { productName: raw.trim() };
      } else if (field === 'category') {
        updates = { category: raw.trim() };
      } else if (field === 'imageUrl') {
        updates = { imageUrl: raw.trim() };
      } else if (field === 'unit') {
        updates = { unit: raw.trim() };
      }
      await onRowUpdate(row.row.rowNumber, updates);
    } finally {
      setSavingRow(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="import-preview">
      <p className="text-xs text-gray-500 px-4 py-2 border-b border-gray-100">
        Click any cell to edit before import. Changes re-validate instantly.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Image</th>
              <th className="px-3 py-2">Product Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Validation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const status = STATUS_LABELS[r.status] ?? STATUS_LABELS.invalid_row;
              const isSaving = savingRow === r.row.rowNumber;
              return (
                <tr
                  key={r.row.rowNumber}
                  className={`border-t border-gray-100 hover:bg-gray-50/50 ${isSaving ? 'opacity-60' : ''}`}
                  data-testid={`preview-row-${r.row.rowNumber}`}
                >
                  <td className="px-3 py-2">
                    {r.row.imageUrl && (r.row.imageUrl.startsWith('http') || r.row.imageUrl.startsWith('/')) ? (
                      <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-gray-100">
                        <Image src={r.row.imageUrl} alt="" fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">—</div>
                    )}
                    <EditableCell
                      value={r.row.imageUrl}
                      onSave={(v) => saveField(r, 'imageUrl', v)}
                      className="text-xs mt-1 max-w-[120px] truncate"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <EditableCell
                      value={r.row.productName}
                      onSave={(v) => saveField(r, 'productName', v)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <EditableCell
                      value={r.row.category}
                      onSave={(v) => saveField(r, 'category', v)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <EditableCell
                      value={r.row.price != null ? String(r.row.price) : ''}
                      onSave={(v) => saveField(r, 'price', v)}
                      type="number"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <EditableCell
                      value={r.row.unit}
                      onSave={(v) => saveField(r, 'unit', v)}
                    />
                  </td>
                  <td className="px-3 py-2">{r.row.active ? 'Active' : 'Inactive'}</td>
                  <td className={`px-3 py-2 font-medium ${status.className}`}>{status.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
          <span className="text-gray-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40">Prev</button>
            <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
