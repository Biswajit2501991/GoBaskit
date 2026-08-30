export type PrefetchedWhatsAppVerification = {
  verified: false;
  mobileE164: string;
  whatsappUrl: string;
  verification: {
    id: string;
    mobile: string;
    verificationCode: string;
    status: string;
    createdAt: string;
    expiresAt: string;
    verifiedAt: string | null;
  };
};

export type PreparedCheckoutVerification =
  | { verified: true; mobileE164: string }
  | PrefetchedWhatsAppVerification;

const inflight = new Map<string, Promise<PreparedCheckoutVerification>>();

/**
 * Reuses one generate request per number so checkout can prefetch
 * and Place Order can open WhatsApp without a second generate.
 */
export function prepareCheckoutVerification(
  mobileE164: string,
  opts?: { customerName?: string; forceNew?: boolean },
): Promise<PreparedCheckoutVerification> {
  const forceNew = opts?.forceNew === true;
  if (!forceNew) {
    const existing = inflight.get(mobileE164);
    if (existing) return existing;
  }

  const promise = (async (): Promise<PreparedCheckoutVerification> => {
    const res = await fetch('/api/customer/verification/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobile: mobileE164,
        customerName: opts?.customerName,
        forceNew,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to generate code');
    }
    if (data.verified) {
      return { verified: true, mobileE164 };
    }
    if (!data.verification || !data.whatsappUrl) {
      throw new Error('Failed to generate code');
    }
    return {
      verified: false,
      mobileE164,
      verification: data.verification,
      whatsappUrl: data.whatsappUrl,
    };
  })().catch((err) => {
    inflight.delete(mobileE164);
    throw err;
  });

  inflight.set(mobileE164, promise);
  return promise;
}

export function clearPreparedCheckoutVerification(mobileE164?: string) {
  if (mobileE164) inflight.delete(mobileE164);
  else inflight.clear();
}
