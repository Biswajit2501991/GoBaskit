export function remainingSentAckWaitSeconds(waitUntilMs: number, nowMs = Date.now()): number {
  if (waitUntilMs <= 0) return 0;
  return Math.max(0, Math.ceil((waitUntilMs - nowMs) / 1000));
}
