import { remainingSentAckWaitSeconds } from '@/lib/sentAckWait';

describe('remainingSentAckWaitSeconds', () => {
  it('returns 0 when no wait is scheduled', () => {
    expect(remainingSentAckWaitSeconds(0, 1_000)).toBe(0);
  });

  it('rounds remaining wait up to whole seconds', () => {
    expect(remainingSentAckWaitSeconds(15_000, 0)).toBe(15);
    expect(remainingSentAckWaitSeconds(15_000, 14_100)).toBe(1);
  });

  it('returns 0 after the wait has elapsed', () => {
    expect(remainingSentAckWaitSeconds(15_000, 15_000)).toBe(0);
    expect(remainingSentAckWaitSeconds(15_000, 20_000)).toBe(0);
  });
});
