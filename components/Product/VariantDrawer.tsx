'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import VariantCard from './VariantCard';
import { activeVariants } from '@/utils/variant';
import type { ProductVariant } from '@/types';

interface VariantDrawerProps {
  open: boolean;
  productName: string;
  variants: ProductVariant[];
  cartQtyByVariant?: Record<string, number>;
  onAdd: (variant: ProductVariant) => void;
  onClose: () => void;
}

export default function VariantDrawer({
  open,
  productName,
  variants,
  cartQtyByVariant = {},
  onAdd,
  onClose,
}: VariantDrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    // Defer all state updates into async callbacks so the enter/exit
    // transitions run without synchronous setState inside the effect body.
    const raf = requestAnimationFrame(() => {
      if (open) {
        setMounted(true);
        requestAnimationFrame(() => setEntered(true));
      } else {
        setEntered(false);
        exitTimer = setTimeout(() => setMounted(false), 250);
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

  if (!mounted) return null;

  const list = activeVariants(variants);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setDragY(delta);
  }
  function handleTouchEnd() {
    if (dragY > 120) {
      onClose();
    }
    setDragY(0);
    touchStartY.current = null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex sm:items-stretch sm:justify-end">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose Option"
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        className={`relative mt-auto w-full max-h-[85vh] rounded-t-2xl bg-white shadow-2xl flex flex-col
          sm:mt-0 sm:ml-auto sm:h-full sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-2xl
          transition-transform duration-250 ease-out
          ${entered
            ? 'translate-y-0 sm:translate-x-0'
            : 'translate-y-full sm:translate-y-0 sm:translate-x-full'}`}
      >
        <div
          className="pt-2 pb-1 sm:hidden cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-start justify-between px-4 pt-2 pb-3 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">Choose Option</h2>
            <p className="text-xs text-gray-500 truncate">Select your preferred brand and size</p>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 p-1 -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {list.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No options available right now.</p>
          ) : (
            list.map((v) => (
              <VariantCard
                key={v.id}
                variant={v}
                inCartQty={cartQtyByVariant[v.id] ?? 0}
                onAdd={onAdd}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
