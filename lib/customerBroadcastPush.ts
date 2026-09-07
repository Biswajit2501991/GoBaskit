export const BROADCAST_TITLE_MAX = 80;
export const BROADCAST_BODY_MAX = 240;

export function sanitizeBroadcastText(raw: unknown, max: number): string {
  return String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function customerBroadcastPayload(input: { title: string; message: string }) {
  const title = sanitizeBroadcastText(input.title, BROADCAST_TITLE_MAX);
  const body = sanitizeBroadcastText(input.message, BROADCAST_BODY_MAX);
  return {
    title,
    body,
    url: '/' as const,
    tag: 'gobaskit-store-broadcast',
  };
}
