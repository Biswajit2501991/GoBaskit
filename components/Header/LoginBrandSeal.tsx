'use client';

import { STORE_NAME } from '@/constants';
import { useBrandLogoUrl } from '@/components/Brand/useBrandLogo';

/** Full store logo on login screens. Uses the same image as the header. */
export default function LoginBrandSeal({ suffix }: { suffix?: string }) {
  const src = useBrandLogoUrl();
  return (
    <div className="flex flex-col items-center mb-4 pt-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={STORE_NAME}
        className="w-full max-w-[220px] h-auto object-contain"
        draggable={false}
      />
      {suffix ? (
        <p className="mt-1 font-sans text-[11px] font-semibold tracking-[0.14em] uppercase text-forest/60">
          {suffix}
        </p>
      ) : null}
    </div>
  );
}
