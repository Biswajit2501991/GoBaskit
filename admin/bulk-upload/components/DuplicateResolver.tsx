'use client';

import type { DuplicateStrategy } from '@/types/BulkUpload';

interface Props {
  value: DuplicateStrategy;
  onChange: (value: DuplicateStrategy) => void;
  duplicateCount: number;
}

const OPTIONS: { value: DuplicateStrategy; label: string; description: string }[] = [
  { value: 'skip', label: 'Skip', description: 'Leave existing products unchanged' },
  { value: 'update', label: 'Update Existing', description: 'Overwrite fields on matching products' },
  { value: 'replace', label: 'Replace Existing', description: 'Replace product data entirely' },
  { value: 'cancel', label: 'Cancel', description: 'Skip all duplicate rows' },
];

export function DuplicateResolver({ value, onChange, duplicateCount }: Props) {
  if (duplicateCount === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
      <p className="text-sm font-semibold text-amber-900 mb-2">
        {duplicateCount} duplicate{duplicateCount > 1 ? 's' : ''} detected — choose handling:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
              value === opt.value ? 'border-blinkit-green bg-white' : 'border-transparent bg-white/60 hover:bg-white'
            }`}
          >
            <input
              type="radio"
              name="duplicateStrategy"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 accent-blinkit-green"
            />
            <span>
              <span className="text-sm font-medium block">{opt.label}</span>
              <span className="text-xs text-gray-500">{opt.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
