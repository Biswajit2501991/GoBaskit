'use client';

import { useRef } from 'react';

interface ZoomImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Product image that magnifies on hover, following the cursor. Uses a ref to
 * update transform-origin directly (no re-renders) for smooth tracking. On
 * touch devices hover simply doesn't trigger, so behaviour is unchanged.
 */
export default function ZoomImage({ src, alt, className = '' }: ZoomImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const el = imgRef.current;
    if (el) el.style.transformOrigin = `${x}% ${y}%`;
  }

  return (
    <div
      className={`group relative overflow-hidden ${className}`}
      onMouseMove={handleMove}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-200 ease-out cursor-zoom-in group-hover:scale-[1.9]"
      />
    </div>
  );
}
