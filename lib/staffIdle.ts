/** Minutes of no staff activity before forced logout. */
export const DEFAULT_STAFF_IDLE_TIMEOUT_MINUTES = 360;
export const MIN_STAFF_IDLE_TIMEOUT_MINUTES = 5;
export const MAX_STAFF_IDLE_TIMEOUT_MINUTES = 720;

export function clampIdleTimeoutMinutes(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_STAFF_IDLE_TIMEOUT_MINUTES;
  return Math.min(
    MAX_STAFF_IDLE_TIMEOUT_MINUTES,
    Math.max(MIN_STAFF_IDLE_TIMEOUT_MINUTES, Math.round(n)),
  );
}

export function isStaffIdleExpired(
  lastActiveAt: Date | null | undefined,
  options: { enabled: boolean; minutes: number },
  nowMs = Date.now(),
): boolean {
  if (!options.enabled) return false;
  if (!lastActiveAt) return false;
  const limitMs = clampIdleTimeoutMinutes(options.minutes) * 60_000;
  return nowMs - lastActiveAt.getTime() >= limitMs;
}
