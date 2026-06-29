'use client';

import type { ValidationSummary } from '@/types/BulkUpload';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  summary: ValidationSummary;
}

export function ValidationSummaryCard({ summary }: Props) {
  const items = [
    { label: `${summary.valid} Valid Products`, icon: CheckCircle2, tone: 'text-green-700 bg-green-50' },
    { label: `${summary.duplicate} Duplicate Products`, icon: AlertTriangle, tone: 'text-amber-700 bg-amber-50', show: summary.duplicate > 0 },
    { label: `${summary.invalidCategory} Invalid Categories`, icon: AlertTriangle, tone: 'text-amber-700 bg-amber-50', show: summary.invalidCategory > 0 },
    { label: `${summary.missingImage} Missing Image`, icon: AlertTriangle, tone: 'text-amber-700 bg-amber-50', show: summary.missingImage > 0 },
    { label: `${summary.missingPrice} Missing Prices`, icon: AlertTriangle, tone: 'text-amber-700 bg-amber-50', show: summary.missingPrice > 0 },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
      {items.filter((i) => i.show !== false).map((item) => (
        <div key={item.label} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${item.tone}`}>
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </div>
      ))}
    </div>
  );
}
