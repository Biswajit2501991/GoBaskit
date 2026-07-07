'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import VariantCard from './VariantCard';
import { getActiveVariants } from '@/utils/variant';
import type { ProductVariant, ProductWithCategory } from '@/types';

interface VariantDrawerProps {
  open: boolean;
  product: Pick<ProductWithCategory, 'name' | 'imageUrl'>;
  variants: ProductVariant[];
  cartQtyByVariant?: Record<string, number>;
  onAdd: (variant: ProductVariant) => void;
  onClose: () => void;
}

export default function VariantDrawer({
  open,
  product,
  variants,
  cartQtyByVariant = {},
  onAdd,
  onClose,
}: VariantDrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

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

  if (!mounted) return null;

  const list = getActiveVariants(variants);

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

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
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
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        className={`relative w-full sm:max-w-md bg-white shadow-2xl flex flex-col
          rounded-t-2xl sm:rounded-2xl max-h-[85vh] sm:max-h-[min(80vh,640px)]
          transition-all duration-200 ease-out
          ${entered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 sm:translate-y-4 sm:scale-95'}`}
      >
        <div
          className="pt-2 pb-1 sm:hidden cursor-grab active:cursor-grabbing shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-start justify-between px-4 pt-3 pb-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0 pr-3">
            <h2 className="text-base font-bold text-gray-900 leading-snug">{product.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Select your preferred brand and size</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center -mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2">
          {list.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">No options available right now.</p>
          ) : (
            list.map((v) => (
              <VariantCard
                key={v.id}
                variant={v}
                product={product}
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
