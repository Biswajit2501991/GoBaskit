'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useConfigStore } from '@/store/configStore';

export const DEFAULT_DELIVERY_DISCLAIMER =
  'Delivery times shown (for example “Delivery in 10 minutes”) are estimates for typical orders in our service area. Most of the time we aim to meet this timeline, but due to unusual circumstances — traffic, weather, high order volume, stock checks, or delivery distance — delivery may take longer. This estimate is not a guaranteed delivery commitment.';

export function resolveDeliveryDisclaimer(text?: string | null): string {
  const trimmed = (text ?? '').trim();
  return trimmed || DEFAULT_DELIVERY_DISCLAIMER;
}

type DeliveryEtaButtonProps = {
  className?: string;
  /** Override label; defaults to admin deliveryTimeText */
  label?: string;
  /** Compact chip style for header / location bar */
  variant?: 'chip' | 'card' | 'inline';
};

/**
 * Tappable delivery ETA. Opens a disclaimer so customers know the time is an estimate,
 * not a binding promise.
 */
export default function DeliveryEtaButton({
  className = '',
  label,
  variant = 'chip',
}: DeliveryEtaButtonProps) {
  const [open, setOpen] = useState(false);
  const deliveryTimeText = useConfigStore((s) => s.homepageConfig.deliveryTimeText);
  const disclaimer = useConfigStore((s) => s.homepageConfig.deliveryDisclaimer);
  const eta = (label ?? deliveryTimeText)?.trim() || 'Delivery in 10 minutes';
  const body = resolveDeliveryDisclaimer(disclaimer);

  const triggerClass =
    variant === 'card'
      ? `w-full text-left bg-white rounded-xl border border-gray-100 p-3.5 flex items-start gap-3 shadow-sm hover:border-blinkit-green/40 transition-colors ${className}`
      : variant === 'inline'
        ? `inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-blinkit-green ${className}`
        : `inline-flex items-center gap-1.5 bg-white/80 hover:bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-800 transition-colors shadow-sm ${className}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClass}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {variant === 'card' ? (
          <>
            <div className="rounded-lg bg-blinkit-green-light p-2 text-blinkit-green shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-gray-900">{eta}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Tap for delivery timeline details</p>
            </div>
          </>
        ) : (
          <>
            <Clock className="w-3.5 h-3.5 text-blinkit-green shrink-0" />
            <span className="truncate">{eta}</span>
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md mx-4" showClose>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blinkit-green" />
              {eta}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed pt-1 text-left">
              {body}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary" className="w-full sm:w-auto">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
