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

/**
 * Resolve canonical city name for a serviceable PIN.
 * Uses pinCityMap when present; if only one serviceable city exists, maps any valid pin to it.
 */
export function cityForPin(params: {
  pin: string;
  serviceablePins: string[];
  serviceableCities: string[];
  pinCityMap?: Record<string, string>;
}): string | null {
  const pin = String(params.pin).trim();
  if (!/^\d{6}$/.test(pin) || !pinIsServiceable(params.serviceablePins, pin)) return null;

  const mapped = params.pinCityMap?.[pin]?.trim();
  if (mapped) {
    const canonical = params.serviceableCities.find(
      (c) => normalizeLocationToken(c) === normalizeLocationToken(mapped),
    );
    return canonical ?? mapped;
  }

  if (params.serviceableCities.length === 1) {
    return params.serviceableCities[0];
  }
  return null;
}

/**
 * Resolve default PIN for a serviceable city (e.g. Adra → 723121).
 */
export function pinForCity(params: {
  city: string;
  serviceablePins: string[];
  serviceableCities: string[];
  cityAliases?: Record<string, string[]>;
  pinCityMap?: Record<string, string>;
  cityDefaultPins?: Record<string, string>;
}): string | null {
  const city = params.city.trim();
  if (
    !city ||
    !cityIsServiceable(params.serviceableCities, city, params.cityAliases ?? {})
  ) {
    return null;
  }

  const cityKey = normalizeLocationToken(city);
  const canonical =
    params.serviceableCities.find((c) => normalizeLocationToken(c) === cityKey) ?? city;

  const defaults = params.cityDefaultPins ?? {};
  const preferred =
    defaults[canonical]?.trim() ||
    defaults[cityKey]?.trim() ||
    Object.entries(defaults).find(([k]) => normalizeLocationToken(k) === cityKey)?.[1]?.trim();

  if (preferred && pinIsServiceable(params.serviceablePins, preferred)) {
    return preferred;
  }

  const fromMap = Object.entries(params.pinCityMap ?? {}).find(
    ([, mappedCity]) => normalizeLocationToken(mappedCity) === cityKey,
  )?.[0];
  if (fromMap && pinIsServiceable(params.serviceablePins, fromMap)) {
    return fromMap;
  }

  // Single-city stores: prefer a stable default among serviceable pins.
  if (params.serviceableCities.length === 1 && params.serviceablePins.length > 0) {
    const pins = [...params.serviceablePins].map((p) => p.trim()).filter(Boolean);
    if (pins.includes('723121')) return '723121';
    return pins[0] ?? null;
  }

  return null;
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
