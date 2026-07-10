'use client';

import { ShieldCheck } from 'lucide-react';

const DEFAULT_CANCELLATION_POLICY =
  'Orders cannot be cancelled once packed for delivery. In case of unexpected delays, a refund will be provided, if applicable. Fresh items are quality-checked before dispatch — message us on WhatsApp if anything is missing or damaged.';

export function resolveCancellationPolicy(text?: string | null): string {
  const trimmed = (text ?? '').trim();
  return trimmed || DEFAULT_CANCELLATION_POLICY;
}

export { DEFAULT_CANCELLATION_POLICY };

export default function CancellationPolicyCard({
  text,
  className = '',
}: {
  text?: string | null;
  className?: string;
}) {
  const policy = resolveCancellationPolicy(text);

  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-4 ${className}`}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 rounded-lg bg-amber-50 p-1.5 text-amber-700 shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm text-gray-900">Cancellation Policy</h3>
          <p className="mt-1 text-xs text-gray-500 leading-relaxed">{policy}</p>
        </div>
      </div>
    </div>
  );
}
