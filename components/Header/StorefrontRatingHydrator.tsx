'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useConfigStore } from '@/store/configStore';
import type { StorefrontRatingPublic } from '@/lib/storefrontRating';

const StorefrontRatingContext = createContext<StorefrontRatingPublic | null>(null);

/** Puts the server-fetched rating on the first HTML so the header does not pop it in later. */
export function StorefrontRatingHydrator({
  rating,
  children,
}: {
  rating: StorefrontRatingPublic;
  children: ReactNode;
}) {
  return <StorefrontRatingContext.Provider value={rating}>{children}</StorefrontRatingContext.Provider>;
}

export function useStorefrontRating(): StorefrontRatingPublic {
  const fromServer = useContext(StorefrontRatingContext);
  const loaded = useConfigStore((s) => s.loaded);
  const fromClient = useConfigStore((s) => s.storefrontRating);
  if (loaded) return fromClient;
  return fromServer ?? fromClient;
}
