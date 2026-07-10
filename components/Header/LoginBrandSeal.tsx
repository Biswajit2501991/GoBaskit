'use client';

import { resolvePublicImageUrl } from '@/utils/image';

/** Premium circular brand seal for the customer login modal. */
export default function LoginBrandSeal({
  logoUrl,
  alt = 'GoBaskit',
}: {
  logoUrl: string;
  alt?: string;
}) {
  const src = resolvePublicImageUrl(logoUrl) || logoUrl;

  return (
    <div className="flex flex-col items-center mb-4 pt-1">
      <div className="login-brand-seal relative w-24 h-24 sm:w-[6.5rem] sm:h-[6.5rem] rounded-full bg-gradient-to-b from-[#fff8dc] via-white to-[#f3f4f6] p-[2px] shadow-[0_8px_24px_rgba(15,23,42,0.10)]">
        <div className="absolute inset-0 rounded-full login-brand-ring pointer-events-none" aria-hidden />
        <div className="relative w-full h-full rounded-full overflow-hidden bg-white border border-[#f7c948]/55 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="w-[90%] h-[90%] object-contain"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
