import { netAfterExpenses, profitTone } from '@/lib/expenseProfit';
import { istDayRange, istYmd } from '@/lib/istDay';

describe('expense net profit tone', () => {
  it('is red on a loss after expenses', () => {
    expect(profitTone(100, 140)).toBe('loss');
    expect(netAfterExpenses(100, 140).net).toBe(-40);
  });

  it('is yellow when remaining profit is 50% or less', () => {
    expect(profitTone(100, 50)).toBe('warn');
    expect(profitTone(100, 60)).toBe('warn');
  });

  it('is green when remaining profit is above 50%', () => {
    expect(profitTone(100, 40)).toBe('good');
    expect(profitTone(100, 0)).toBe('good');
  });

  it('is neutral when both sides are zero', () => {
    expect(profitTone(0, 0)).toBe('neutral');
  });
});

describe('IST day range', () => {
  it('covers a full India calendar day', () => {
    const range = istDayRange('2026-09-15');
    expect(range).not.toBeNull();
    expect(range!.from.toISOString()).toBe('2026-09-14T18:30:00.000Z');
    expect(range!.to.toISOString()).toBe('2026-09-15T18:29:59.999Z');
  });

  it('returns today as YYYY-MM-DD in Kolkata', () => {
    expect(istYmd(new Date('2026-09-15T18:00:00.000Z'))).toBe('2026-09-15');
    expect(istYmd(new Date('2026-09-15T18:30:00.000Z'))).toBe('2026-09-16');
  });
});
