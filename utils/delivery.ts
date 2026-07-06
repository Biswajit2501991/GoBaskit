/** Normalize city/pin strings for case-insensitive, space-insensitive comparison. */
export function normalizeLocationToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function pinIsServiceable(pins: string[], pin: string): boolean {
  const normalized = String(pin).trim();
  if (!normalized) return false;
  return pins.map((p) => p.trim()).includes(normalized);
}

/**
 * Match customer city against serviceable cities and optional aliases.
 * Aliases map canonical city → alternate spellings, e.g. { "craigieburn": ["craigie burn"] }
 */
export function cityIsServiceable(
  serviceableCities: string[],
  city: string,
  aliases: Record<string, string[]> = {},
): boolean {
  const normalized = normalizeLocationToken(city);
  if (!normalized) return false;

  const candidates = new Set<string>();
  for (const c of serviceableCities) {
    const key = normalizeLocationToken(c);
    if (key) candidates.add(key);
    const alt = aliases[key] ?? aliases[c] ?? [];
    for (const a of alt) {
      const n = normalizeLocationToken(a);
      if (n) candidates.add(n);
    }
  }

  return candidates.has(normalized);
}

export function deliveryIsServiceable(params: {
  serviceablePins: string[];
  serviceableCities: string[];
  city: string;
  pincode: string;
  cityAliases?: Record<string, string[]>;
}): boolean {
  const pinOk = pinIsServiceable(params.serviceablePins, params.pincode);
  const cityOk = cityIsServiceable(
    params.serviceableCities,
    params.city,
    params.cityAliases ?? {},
  );
  return pinOk || cityOk;
}

/** Haversine distance in kilometres between two GPS points. */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
