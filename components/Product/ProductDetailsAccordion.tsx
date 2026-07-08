'use client';

import { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';

interface ProductDetailsAccordionProps {
  details: string;
  /** Whether the section starts expanded. */
  defaultOpen?: boolean;
}

interface Row {
  label: string;
  value: string;
}

/** Splits the raw details text into "Label: Value" spec rows and free paragraphs. */
function parseDetails(details: string): { rows: Row[]; paragraphs: string[] } {
  const rows: Row[] = [];
  const paragraphs: string[] = [];
  for (const rawLine of details.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    // Treat as a spec row only when the label before ':' is short and non-empty.
    if (idx > 0 && idx <= 40 && idx < line.length - 1) {
      rows.push({ label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() });
    } else {
      paragraphs.push(line);
    }
  }
  return { rows, paragraphs };
}

export default function ProductDetailsAccordion({
  details,
  defaultOpen = false,
}: ProductDetailsAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const trimmed = details?.trim();
  if (!trimmed) return null;

  const { rows, paragraphs } = parseDetails(trimmed);

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 font-bold text-gray-900 text-base">
          <FileText className="w-4 h-4 text-blinkit-green" />
          Product Details
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold text-blinkit-green">
          {open ? 'Hide' : 'Show'}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 space-y-4">
            {rows.length > 0 && (
              <dl className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {rows.map((row, i) => (
                  <div key={i} className="flex gap-3 px-4 py-2.5">
                    <dt className="w-2/5 text-sm text-gray-500">{row.label}</dt>
                    <dd className="w-3/5 text-sm font-medium text-gray-800">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {paragraphs.map((p, i) => (
              <p key={i} className="text-sm text-gray-600 leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
