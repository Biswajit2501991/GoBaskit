/** Per-tab session cache for WhatsApp verification — avoids re-checking / UI flash. */

const KEY = 'gobaskit_whatsapp_verified_e164';

export function getSessionVerifiedMobile(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(KEY)?.trim() || '';
    return value || null;
  } catch {
    return null;
  }
}

export function setSessionVerifiedMobile(mobileE164: string): void {
  if (typeof window === 'undefined' || !mobileE164) return;
  try {
    sessionStorage.setItem(KEY, mobileE164);
  } catch {
    /* private mode */
  }
}

export function clearSessionVerifiedMobile(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function isMobileVerifiedInSession(mobileE164: string): boolean {
  if (!mobileE164) return false;
  return getSessionVerifiedMobile() === mobileE164;
}
