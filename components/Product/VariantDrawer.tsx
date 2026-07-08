'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import VariantCard from './VariantCard';
import type { ProductOption } from '@/types';

interface VariantDrawerProps {
  open: boolean;
  productName: string;
  options: ProductOption[];
  cartQtyByKey?: Record<string, number>;
  onAdd: (option: ProductOption) => void;
  onClose: () => void;
}

export default function VariantDrawer({
  open,
  productName,
  options,
  cartQtyByKey = {},
  onAdd,
  onClose,
}: VariantDrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

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
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !portalRoot) return null;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setDragY(delta);
  }
  function handleTouchEnd() {
    if (dragY > 100) onClose();
    setDragY(0);
    touchStartY.current = null;
  }

  const sheetTransform = dragY > 0 ? `translateY(${dragY}px)` : entered ? 'translateY(0)' : 'translateY(100%)';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose option"
        style={{ transform: sheetTransform }}
        className={`relative w-full sm:max-w-md bg-white shadow-2xl rounded-t-2xl sm:rounded-2xl
          max-h-[min(88dvh,100%)] sm:max-h-[min(80vh,640px)]
          transition-[transform,opacity] duration-200 ease-out
          ${entered ? 'opacity-100' : 'opacity-0'}`}
      >
        <div
          className="pt-2 pb-1 sm:hidden cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-start justify-between px-4 pt-2 pb-3 sm:pt-4 border-b border-gray-100">
          <div className="min-w-0 pr-3">
            <h2 className="text-base font-bold text-gray-900 leading-snug">{productName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Select your preferred brand and size</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2
            pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4
            max-h-[calc(min(88dvh,100%)-5.5rem)] sm:max-h-[calc(min(80vh,640px)-5.5rem)]"
        >
          {options.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">No options available right now.</p>
          ) : (
            options.map((o) => (
              <VariantCard
                key={o.key}
                option={o}
                inCartQty={cartQtyByKey[o.key] ?? 0}
                onAdd={onAdd}
              />
            ))
          )}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
