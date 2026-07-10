'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X } from 'lucide-react';
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
 * not a binding promise. Mobile = bottom sheet; desktop = centered card.
 */
export default function DeliveryEtaButton({
  className = '',
  label,
  variant = 'chip',
}: DeliveryEtaButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const deliveryTimeText = useConfigStore((s) => s.homepageConfig.deliveryTimeText);
  const disclaimer = useConfigStore((s) => s.homepageConfig.deliveryDisclaimer);
  const eta = (label ?? deliveryTimeText)?.trim() || 'Delivery in 10 minutes';
  const body = resolveDeliveryDisclaimer(disclaimer);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      if (open) {
        setMounted(true);
        requestAnimationFrame(() => setEntered(true));
      } else {
        setEntered(false);
        exitTimer = setTimeout(() => setMounted(false), 200);
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

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

      {mounted && portalRoot
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4">
              <button
                type="button"
                aria-label="Close delivery details"
                onClick={() => setOpen(false)}
                className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
                  entered ? 'opacity-100' : 'opacity-0'
                }`}
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="delivery-eta-title"
                className={`relative z-10 w-full sm:max-w-md bg-white shadow-2xl
                  rounded-t-2xl sm:rounded-2xl
                  px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]
                  max-h-[min(85svh,560px)] overflow-y-auto
                  transition-transform duration-200 ease-out
                  ${entered ? 'translate-y-0 sm:scale-100 opacity-100' : 'translate-y-full sm:translate-y-4 sm:scale-95 opacity-0'}`}
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200 sm:hidden" aria-hidden />

                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2
                    id="delivery-eta-title"
                    className="flex items-center gap-2 text-base font-bold text-gray-900 pr-2"
                  >
                    <Clock className="w-5 h-5 text-blinkit-green shrink-0" />
                    <span>{eta}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">{body}</p>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full mt-5"
                  onClick={() => setOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>,
            portalRoot,
          )
        : null}
    </>
  );
}
