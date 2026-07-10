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
    <div className="flex flex-col items-center mb-5">
      <div className="login-brand-seal relative w-[7.25rem] h-[7.25rem] rounded-full bg-gradient-to-b from-[#fff8dc] via-white to-[#f3f4f6] p-[3px] shadow-[0_10px_28px_rgba(15,23,42,0.12)]">
        <div className="absolute inset-0 rounded-full login-brand-ring pointer-events-none" aria-hidden />
        <div className="relative w-full h-full rounded-full overflow-hidden bg-white border border-[#f7c948]/60 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="w-[92%] h-[92%] object-contain"
            draggable={false}
          />
        </div>
      </div>
      <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400">
        Groceries in minutes
      </p>
    </div>
  );
}
