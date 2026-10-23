'use client';

import { BRAND_MARK_SRC, STORE_NAME } from '@/constants';

/** Circular GoBasket seal. Same mark as the header, with the name under it. */
export default function LoginBrandSeal({ suffix }: { suffix?: string }) {
  return (
    <div className="flex flex-col items-center mb-4 pt-1">
      <div className="login-brand-seal relative w-24 h-24 sm:w-[6.5rem] sm:h-[6.5rem] rounded-full bg-gradient-to-b from-paper via-white to-[#F7F3EA] p-[2px] shadow-[0_8px_24px_rgba(20,48,40,0.12)]">
        <div className="absolute inset-0 rounded-full login-brand-ring pointer-events-none" aria-hidden />
        <div className="relative w-full h-full rounded-full overflow-hidden bg-paper border border-leaf/30 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_MARK_SRC}
            alt={STORE_NAME}
            className="w-[78%] h-[78%] object-contain"
            draggable={false}
          />
        </div>
      </div>
      <p className="mt-3 font-display text-xl font-semibold tracking-tight text-forest leading-none">
        {STORE_NAME}
        {suffix ? (
          <span className="font-sans text-[11px] font-semibold tracking-[0.14em] uppercase ml-1.5 text-forest/60">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}
