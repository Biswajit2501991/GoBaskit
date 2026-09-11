/** Customer-typed delivery lines (house / street / area). City and PIN stay on their own rules. */

export type DeliveryAddressKind = 'house' | 'street' | 'area' | 'landmark' | 'notes';

const MAX_LEN: Record<DeliveryAddressKind, number> = {
  house: 100,
  street: 120,
  area: 80,
  landmark: 80,
  notes: 200,
};

/** Whole-line placeholders. */
const JUNK_LINE =
  /^(test|testing|tets|asdf+|asfa|adfas|qwer(ty)?|zxcv|qwe+|abc+|xyz+|xxx+|zzz+|n\/?a|na|nil|none|null|dummy|fake|foo|bar|lorem|ipsum|unknown|address|home|here|there|asdfg|hjkl|qazwsx|aaaa+|bbbb+|cccc+|meow+|jj+|hhh+)$/i;

const JUNK_TOKENS = new Set([
  'test',
  'testing',
  'tets',
  'asdf',
  'asfa',
  'adfas',
  'qwer',
  'qwerty',
  'zxcv',
  'xyz',
  'xxx',
  'meow',
  'dummy',
  'fake',
  'lorem',
  'ipsum',
  'asdfg',
  'hjkl',
  'qazwsx',
  'rtfjrt',
  'jhrfju',
  'gfjht',
  'afafd',
  'jtirt',
]);

/**
 * Short real lines and neighbourhood words already used by GoBaskit customers
 * (Adra / Raghunathpur area). Matching these keeps village names, SBI, L 42, DVC.
 */
const KNOWN_SHORT_LINES = new Set(
  [
    'sbi',
    'dvc',
    'ncc',
    'pnb',
    'fci',
    'rly',
    'adra',
    'nagar',
    'village',
    'vill',
    'central',
    'senera',
    'arrah',
    'arraha',
    'baskuli',
    'neturia',
    'chakalta',
    'dubradih',
    'park st',
    'l 42',
    'ncc club',
    'sanka',
    'indrabil',
    'keliathol',
    'panchudang',
    'panchudanga',
  ].map((s) => s.toLowerCase()),
);

const LOCALITY_WORDS = new Set(
  [
    'adra',
    'sbi',
    'dvc',
    'ncc',
    'pnb',
    'fci',
    'rly',
    'para',
    'pada',
    'pally',
    'palli',
    'pali',
    'pully',
    'nagar',
    'colony',
    'mandir',
    'mondir',
    'mander',
    'masjid',
    'mazid',
    'mahzidpara',
    'road',
    'rode',
    'street',
    'lane',
    'gali',
    'galli',
    'maidan',
    'market',
    'bajar',
    'school',
    'station',
    'railway',
    'stadium',
    'statue',
    'park',
    'club',
    'office',
    'bank',
    'gym',
    'shop',
    'store',
    'tower',
    'twar',
    'tawar',
    'temple',
    'ashram',
    'gurudwara',
    'church',
    'more',
    'hat',
    'gram',
    'dih',
    'plot',
    'quarter',
    'qtr',
    'sector',
    'block',
    'ward',
    'mission',
    'missionpara',
    'beniasole',
    'beniasol',
    'benisol',
    'baniasol',
    'baniasole',
    'baniyasol',
    'subhas',
    'subhash',
    'subhashnagar',
    'arabinda',
    'arabindo',
    'arbinda',
    'arbindapally',
    'arbindopally',
    'arvind',
    'arovindo',
    'panchudanga',
    'panchudang',
    'polashkola',
    'palashkola',
    'polaskola',
    'bakradanga',
    'kamlasthan',
    'barabagan',
    'paschim',
    'raghunathpur',
    'kashipur',
    'gayadhi',
    'gayahid',
    'doulatpur',
    'talajuri',
    'neturia',
    'senera',
    'sanka',
    'chakalta',
    'dubradih',
    'indrabil',
    'keliathol',
    'kantaranguni',
    'katanranguni',
    'jhariadih',
    'wireless',
    'muharram',
    'jaipal',
    'accounts',
    'young',
    'hotel',
    'xerox',
    'stadium',
    'sersa',
    'sersha',
    'hathi',
    'hanuman',
    'durga',
    'shiv',
    'shiva',
    'kali',
    'mansha',
    'mansa',
    'santoshi',
    'hari',
    'hori',
    'harimandir',
    'imam',
    'immabara',
    'bada',
    'jama',
    'church',
    'jinbanpur',
    'unanshila',
    'joychandi',
    'joyte',
    'laldanga',
    'bangalpara',
    'majee',
    'majhi',
    'das',
    'village',
    'vill',
    'central',
    'nagar',
    'lower',
    'upper',
    'uppar',
    'purulia',
    'anara',
    'nanduara',
    'gopinathpur',
    'vidyasagar',
    'vodafone',
    'vodaphone',
    'canara',
    'state',
    'board',
    'godown',
    'ground',
    'bridge',
    'tank',
    'transformer',
    'printer',
    'medical',
    'post',
    'community',
    'residency',
    'bhaban',
    'bhawan',
    'niwas',
    'nivas',
    'colony',
    'retirement',
    'arbinda',
    'pally',
  ].map((s) => s.toLowerCase()),
);

export function normalizeAddressLine(raw: string): string {
  return raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

function letters(value: string): string {
  return value.replace(/[^\p{L}]/gu, '');
}

function alnum(value: string): string {
  return value.replace(/[^\p{L}\p{N}]/gu, '');
}

function compactForRepeat(value: string): string {
  return value.replace(/[\s./#,_\-\\]+/g, '');
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function looksLikeUrlOrHandle(value: string): boolean {
  return /https?:\/\/|www\.|\.com\b/.test(value.toLowerCase());
}

function isRepeatedCharLine(value: string): boolean {
  const compact = compactForRepeat(value);
  return compact.length >= 3 && /^(.)\1+$/u.test(compact);
}

function containsJunkToken(value: string): boolean {
  return tokens(value).some((tok) => JUNK_TOKENS.has(tok));
}

function isPlaceholderLine(value: string): boolean {
  const compact = compactForRepeat(value).toLowerCase();
  if (!compact) return true;
  if (JUNK_LINE.test(value.trim()) || JUNK_LINE.test(compact)) return true;
  if (containsJunkToken(value)) return true;
  return false;
}

function isPlotOrQuarterLine(value: string): boolean {
  return /\p{L}/u.test(value) && /\p{N}/u.test(value);
}

const learnedLocalities = new Set<string>();
const MAX_LEARNED_LOCALITIES = 500;

export function isKnownLocalityLine(value: string): boolean {
  const normalized = normalizeAddressLine(value).toLowerCase();
  if (!normalized) return false;
  if (KNOWN_SHORT_LINES.has(normalized) || learnedLocalities.has(normalized.replace(/\s+/g, ''))) return true;
  if (isPlotOrQuarterLine(normalized)) return true;
  return tokens(normalized).some(
    (tok) => LOCALITY_WORDS.has(tok) || learnedLocalities.has(tok),
  );
}

export function setLearnedDeliveryLocalities(words: readonly string[] | null | undefined): void {
  learnedLocalities.clear();
  for (const word of words ?? []) {
    const token = sanitizeLearnedLocality(word);
    if (token) learnedLocalities.add(token);
  }
}

export function sanitizeLearnedLocality(raw: string): string | null {
  const token = String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (token.length < 3 || token.length > 32) return null;
  if (/^\d+$/.test(token)) return null;
  if (JUNK_TOKENS.has(token) || JUNK_LINE.test(token)) return null;
  if (LOCALITY_WORDS.has(token)) return null;
  return token;
}

export function extractLearnableTokens(...lines: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const line of lines) {
    for (const tok of tokens(normalizeAddressLine(line ?? ''))) {
      const sanitized = sanitizeLearnedLocality(tok);
      if (sanitized) out.add(sanitized);
    }
  }
  return [...out];
}

export function parseDeliveryLocalities(raw: unknown): string[] {
  let source: unknown[] = [];
  if (Array.isArray(raw)) source = raw;
  else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      source = Array.isArray(parsed) ? parsed : trimmed.split(/[,\n]/);
    } catch {
      source = trimmed.split(/[,\n]/);
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of source) {
    const token = sanitizeLearnedLocality(String(item ?? ''));
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= MAX_LEARNED_LOCALITIES) break;
  }
  return out;
}

const REPEAT_SKIP = new Set([
  'near',
  'behind',
  'beside',
  'opposite',
  'towards',
  'from',
  'with',
  'and',
  'the',
  'for',
  'house',
  'ghar',
  'shop',
  'road',
  'lane',
  'para',
  'pally',
]);

/** Same copied line, or the same non-locality word used in more than one of house/street/area. */
export function repeatedAddressContentError(house: string, street: string, area: string): string | null {
  const h = normalizeAddressLine(house).toLowerCase();
  const s = normalizeAddressLine(street).toLowerCase();
  const a = normalizeAddressLine(area).toLowerCase();
  const pairs: Array<[string, string]> = [
    [h, s],
    [h, a],
    [s, a],
  ];
  for (const [left, right] of pairs) {
    if (left && right && left === right && !isKnownLocalityLine(left)) {
      return 'House, street, and area should not copy the same text. Add the real street and area.';
    }
  }

  const fieldTokens = [h, s, a].map(
    (line) =>
      new Set(
        tokens(line).filter((tok) => tok.length >= 5 && !REPEAT_SKIP.has(tok) && !LOCALITY_WORDS.has(tok) && !learnedLocalities.has(tok) && !/^\d+$/.test(tok)),
      ),
  );
  const seen = new Map<string, number>();
  for (const set of fieldTokens) {
    for (const tok of set) {
      seen.set(tok, (seen.get(tok) ?? 0) + 1);
    }
  }
  for (const [tok, count] of seen) {
    if (count >= 2) {
      return `Don't repeat "${tok}" in more than one address line.`;
    }
  }
  return null;
}

export function deliveryAddressLineError(raw: string, kind: DeliveryAddressKind): string | null {
  const value = normalizeAddressLine(raw).slice(0, MAX_LEN[kind]);
  if (kind === 'landmark' || kind === 'notes') {
    if (!value) return null;
    if (normalizeAddressLine(raw).length > MAX_LEN[kind]) {
      return 'That address line is too long';
    }
    if (looksLikeUrlOrHandle(value)) {
      return 'Enter a delivery address, not a website or handle';
    }
    // Optional lines: skip leftover "Hhh" / "jj" so a real house/street/area still checks out.
    if (isRepeatedCharLine(value) || isPlaceholderLine(value) || (value.length < 3 && !isKnownLocalityLine(value))) {
      return null;
    }
    return null;
  }

  if (!value) {
    if (kind === 'house') return 'Enter your house or flat number';
    if (kind === 'street') return 'Enter the street or road name';
    if (kind === 'area') return 'Enter your area or colony';
    return null;
  }

  if (normalizeAddressLine(raw).length > MAX_LEN[kind]) {
    return 'That address line is too long';
  }

  if (looksLikeUrlOrHandle(value)) {
    return 'Enter a delivery address, not a website or handle';
  }

  if (isRepeatedCharLine(value) || isPlaceholderLine(value)) {
    return 'Enter a real delivery address, not a placeholder';
  }

  const letterCount = letters(value).length;
  const alnumCount = alnum(value).length;
  const local = isKnownLocalityLine(value);

  if (kind === 'house') {
    if (alnumCount < 1) return 'Enter a house or flat number we can find';
    return null;
  }

  if (kind === 'street') {
    if (local && value.length >= 2 && letterCount >= 1) return null;
    if (value.length < 4 || letterCount < 2) {
      return 'Enter the full street or road (for example Station Road)';
    }
    return null;
  }

  if (kind === 'area') {
    if (local && value.length >= 2 && letterCount >= 1) return null;
    if (value.length < 3 || letterCount < 2) {
      return 'Enter the area or colony (for example Railway Colony)';
    }
    return null;
  }

  if (alnumCount < 2) {
    return 'Enter a real landmark or instruction';
  }
  return null;
}

export function assertDeliveryAddressLines(params: {
  houseNumber: string;
  street: string;
  area: string;
  landmark?: string | null;
  deliveryNotes?: string | null;
}): void {
  const houseNumber = normalizeAddressLine(params.houseNumber);
  const street = normalizeAddressLine(params.street);
  const area = normalizeAddressLine(params.area);
  const landmark = normalizeAddressLine(params.landmark ?? '');
  const deliveryNotes = normalizeAddressLine(params.deliveryNotes ?? '');

  const houseErr = deliveryAddressLineError(houseNumber, 'house');
  if (houseErr) throw Object.assign(new Error(houseErr), { field: 'houseNumber' });
  const streetErr = deliveryAddressLineError(street, 'street');
  if (streetErr) throw Object.assign(new Error(streetErr), { field: 'street' });
  const areaErr = deliveryAddressLineError(area, 'area');
  if (areaErr) throw Object.assign(new Error(areaErr), { field: 'area' });
  const landmarkErr = deliveryAddressLineError(landmark, 'landmark');
  if (landmarkErr) throw Object.assign(new Error(landmarkErr), { field: 'landmark' });
  const notesErr = deliveryAddressLineError(deliveryNotes, 'notes');
  if (notesErr) throw Object.assign(new Error(notesErr), { field: 'deliveryNotes' });

  const repeatErr = repeatedAddressContentError(houseNumber, street, area);
  if (repeatErr) throw Object.assign(new Error(repeatErr), { field: 'street' });
}
