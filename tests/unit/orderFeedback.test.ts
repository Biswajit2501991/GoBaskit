import {
  countFeedbackWords,
  ORDER_FEEDBACK_MAX_WORDS,
} from '@/lib/orderFeedback';

describe('order feedback notes', () => {
  it('counts words and enforces the 50-word cap', () => {
    expect(countFeedbackWords('  good   delivery  ')).toBe(2);
    expect(ORDER_FEEDBACK_MAX_WORDS).toBe(50);
    const fifty = Array.from({ length: 50 }, (_, i) => `w${i}`).join(' ');
    expect(countFeedbackWords(fifty)).toBe(50);
    expect(countFeedbackWords(`${fifty} extra`)).toBe(51);
  });
});
