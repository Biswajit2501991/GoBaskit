const OPENED_PATH = '/api/customer/verification/opened';
/** Wait briefly so verify can finish before WhatsApp steals the page. Do not abort the fetch. */
const OPENED_WAIT_MS = 2000;

export type NotifyWhatsAppOpenedPayload = {
  mobile: string;
  verificationId: string;
};

function trySendBeacon(url: string, body: string): boolean {
  if (typeof navigator === 'undefined' || typeof Blob === 'undefined') return false;
  if (typeof navigator.sendBeacon !== 'function') return false;
  try {
    return navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
  } catch {
    return false;
  }
}

/**
 * Auto-approve by telling the server WhatsApp was opened, then the caller opens the chat.
 * Uses keepalive + sendBeacon so same-window navigation (popup blocked) does not drop the POST.
 * Does not abort an in-flight request — that would risk cancelling the verify on the server.
 */
export async function notifyWhatsAppOpened(
  payload: NotifyWhatsAppOpenedPayload,
): Promise<{ verified: boolean }> {
  const body = JSON.stringify({
    mobile: payload.mobile,
    verificationId: payload.verificationId,
  });

  const fetchPromise = fetch(OPENED_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  })
    .then(async (res) => {
      const data = (await res.json().catch(() => ({}))) as { verified?: unknown };
      return res.ok && data.verified === true;
    })
    .catch(() => false);

  const timed = await Promise.race([
    fetchPromise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), OPENED_WAIT_MS);
    }),
  ]);

  if (timed === true) return { verified: true };

  trySendBeacon(OPENED_PATH, body);
  return { verified: false };
}
