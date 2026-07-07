'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ProductImageCarouselProps {
  images: string[];
  alt: string;
  fallback: ReactNode;
  /** Milliseconds between auto-advances. */
  intervalMs?: number;
}

/**
 * Shows a single product image, or — when a product exposes multiple option
 * images — gently crossfades through them. Motion only runs while the card is
 * on-screen and not hovered, and is fully disabled for users who prefer
 * reduced motion.
 */
export default function ProductImageCarousel({
  images,
  alt,
  fallback,
  intervalMs = 2800,
}: ProductImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const multiple = images.length > 1;

  useEffect(() => {
    const el = ref.current;
    if (!el || !multiple) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [multiple]);

  useEffect(() => {
    if (!multiple || !inView || paused) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [multiple, inView, paused, images.length, intervalMs]);

  if (images.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-4xl">{fallback}</div>;
  }

  if (!multiple) {
    return (
      <img
        src={images[0]}
        alt={alt}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
    );
  }

  return (
    <div
      ref={ref}
      className="absolute inset-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={alt}
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out group-hover:scale-105 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-1 pointer-events-none">
        {images.map((src, i) => (
          <span
            key={src}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === index ? 'w-3 bg-blinkit-green' : 'w-1 bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
