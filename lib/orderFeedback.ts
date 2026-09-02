export const ORDER_FEEDBACK_MAX_WORDS = 50;

export function countFeedbackWords(note: string): number {
  return note.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizeFeedbackNote(note: string | undefined): string | null {
  const trimmed = typeof note === 'string' ? note.trim() : '';
  return trimmed ? trimmed : null;
}
